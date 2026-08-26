"""
认证服务
"""
from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import logging
import re
import secrets
import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session
from app.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRATION_HOURS
from app.config import (
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_PASSWORD_WAS_GENERATED,
    DEFAULT_ADMIN_USERNAME,
)
from app.models.user import User


logger = logging.getLogger(__name__)
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
LEGACY_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify current scrypt hashes and legacy SHA-256 hashes."""
    if LEGACY_SHA256_RE.fullmatch(hashed_password):
        expected_hash = hashlib.sha256(plain_password.encode()).hexdigest()
        return hmac.compare_digest(expected_hash, hashed_password)

    try:
        algorithm, n, r, p, encoded_salt, encoded_digest = hashed_password.split("$", 5)
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(encoded_salt.encode("ascii"))
        expected = base64.urlsafe_b64decode(encoded_digest.encode("ascii"))
        actual = hashlib.scrypt(
            plain_password.encode("utf-8"),
            salt=salt,
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=32,
    )
    encoded_salt = base64.urlsafe_b64encode(salt).decode("ascii")
    encoded_digest = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${encoded_salt}${encoded_digest}"


def password_needs_rehash(hashed_password: str) -> bool:
    return not hashed_password.startswith(f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}$")


def create_access_token(username: str) -> str:
    """创建JWT Token"""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode = {"sub": username, "iat": now, "exp": expire, "jti": secrets.token_urlsafe(16)}
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> str | None:
    """验证JWT Token，返回用户名"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except InvalidTokenError:
        return None


def init_admin_user(db: Session) -> None:
    """初始化管理员用户"""
    # 检查是否已存在admin用户
    existing = db.query(User).filter(User.username == DEFAULT_ADMIN_USERNAME).first()
    if not existing:
        admin = User(
            username=DEFAULT_ADMIN_USERNAME,
            password_hash=get_password_hash(DEFAULT_ADMIN_PASSWORD),
            role="admin",
        )
        db.add(admin)
        db.commit()
        if DEFAULT_ADMIN_PASSWORD_WAS_GENERATED:
            logger.warning(
                "Created the initial admin account. One-time generated password: %s",
                DEFAULT_ADMIN_PASSWORD,
            )
    elif existing.role != "admin":
        # 确保默认admin用户的角色为admin
        existing.role = "admin"
        db.commit()


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    """认证用户"""
    user = db.query(User).filter(User.username == username).first()
    if user and verify_password(password, user.password_hash):
        if password_needs_rehash(user.password_hash):
            user.password_hash = get_password_hash(password)
            db.commit()
            db.refresh(user)
        return user
    return None
