"""Application configuration loaded from environment variables."""

import logging
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv


logger = logging.getLogger(__name__)

# 项目根目录（项目根，即 backend/ 的父目录）
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")
# 后端目录（backend/），模型和数据放在这里
BASE_DIR = Path(__file__).resolve().parent.parent
_configured_data_dir = os.getenv("MEETING_SUMMARY_DATA_DIR", "").strip()
DATA_DIR = Path(_configured_data_dir or PROJECT_ROOT / "data").expanduser().resolve()
AUDIO_DIR = DATA_DIR / "audio"

# FunASR模型配置
# 模型放在 backend/models/ 目录下
_configured_model_dir = os.getenv("MEETING_SUMMARY_MODEL_DIR", "").strip()
MODEL_DIR = Path(_configured_model_dir or BASE_DIR / "models").expanduser().resolve()

# 确保目录存在
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 数据库路径
DATABASE_PATH = DATA_DIR / "database.db"

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()


def _load_jwt_secret() -> str:
    configured = os.getenv("JWT_SECRET_KEY", "").strip()
    if configured:
        if len(configured) < 32:
            raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters")
        return configured

    if APP_ENV in {"production", "prod"}:
        raise RuntimeError("JWT_SECRET_KEY is required when APP_ENV=production")

    secret_path = DATA_DIR / ".jwt-secret"
    if secret_path.exists():
        return secret_path.read_text(encoding="utf-8").strip()

    generated = secrets.token_urlsafe(48)
    secret_path.write_text(generated, encoding="utf-8")
    try:
        secret_path.chmod(0o600)
    except OSError:
        pass
    logger.warning("JWT_SECRET_KEY was not set; generated a local development key in %s", secret_path)
    return generated


# JWT配置
JWT_SECRET_KEY = _load_jwt_secret()
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))

# 默认管理员账号
DEFAULT_ADMIN_USERNAME = "admin"
_configured_admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "").strip()
DEFAULT_ADMIN_PASSWORD_WAS_GENERATED = not bool(_configured_admin_password)
DEFAULT_ADMIN_PASSWORD = _configured_admin_password or secrets.token_urlsafe(15)

# 测试用LLM配置
DEFAULT_LLM_BASEURL = "https://open.bigmodel.cn/api/paas/v4"
DEFAULT_LLM_APIKEY = ""
DEFAULT_LLM_MODEL = "glm-4.7-flash"

MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_SIZE_MB", "200")) * 1024 * 1024

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:13002,http://127.0.0.1:13002",
    ).split(",")
    if origin.strip()
]
