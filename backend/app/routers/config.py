"""
系统配置路由
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.routers.auth import require_role
from app.services.config_service import get_all_configs, update_configs, get_config_value
from app.schemas.config import ConfigResponse, ConfigUpdate

router = APIRouter(prefix="/api/config", tags=["系统配置"])


@router.get("", response_model=ConfigResponse)
def get_config(
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """
    获取系统配置（需要管理员权限）
    """
    return get_all_configs(db)


@router.put("")
def update_config(
    config_data: ConfigUpdate,
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """
    更新系统配置（需要管理员权限）
    """
    update_configs(db, config_data)
    return {"message": "updated"}


@router.get("/dingtalk-status")
def get_dingtalk_status(db: Session = Depends(get_db)):
    """
    检查钉钉 Webhook 是否已配置（公开接口，不返回敏感信息）
    """
    webhook = get_config_value(db, "dingtalk_webhook")
    return {"configured": bool(webhook)}
