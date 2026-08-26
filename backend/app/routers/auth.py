"""
认证路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.services.auth_service import (
    authenticate_user, create_access_token, get_password_hash, verify_password, verify_token
)
from app.services.config_service import get_config_value
from app.schemas.user import PasswordChange, UserLogin, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["认证"])
security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    获取当前用户对象（验证Token）
    """
    auth_enabled = get_config_value(db, "auth_enabled").lower() == "true"
    if credentials:
        username = verify_token(credentials.credentials)
        user = db.query(User).filter(User.username == username).first() if username else None
        if user:
            return user
        if auth_enabled:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token无效或已过期"
            )
    elif auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证信息"
        )

    anon = db.query(User).filter(User.username == "anonymous").first()
    return anon or User(username="anonymous", password_hash="", role="user")


def require_role(required_role: str):
    """
    依赖注入：检查用户角色是否满足要求
    """
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="需要管理员权限"
            )
        return current_user
    return role_checker


@router.post("/login", response_model=TokenResponse)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    用户登录
    """
    auth_enabled = get_config_value(db, "auth_enabled").lower() == "true"
    user = authenticate_user(db, user_data.username, user_data.password)
    if user:
        return TokenResponse(access_token=create_access_token(user.username))
    if not auth_enabled:
        return TokenResponse(access_token=create_access_token("anonymous"))

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="用户名或密码错误"
    )


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """
    用户登出（前端清除Token即可）
    """
    return {"message": "success"}


@router.post("/change-password")
def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password after verifying the old password."""
    if not current_user.id or not verify_password(
        password_data.old_password, current_user.password_hash
    ):
        raise HTTPException(status_code=400, detail="旧密码错误")

    current_user.password_hash = get_password_hash(password_data.new_password)
    db.commit()
    return {"message": "password changed"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """
    获取当前用户信息
    """
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "created_at": current_user.created_at,
    }
