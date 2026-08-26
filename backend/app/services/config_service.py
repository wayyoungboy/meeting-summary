"""
系统配置服务
"""
from sqlalchemy.orm import Session
from app.models.config import Config
from app.config import (
    DEFAULT_LLM_BASEURL, DEFAULT_LLM_APIKEY, DEFAULT_LLM_MODEL
)
from app.schemas.config import ConfigResponse, ConfigUpdate


DEFAULT_CONFIGS = {
    "llm_baseurl": DEFAULT_LLM_BASEURL,
    "llm_apikey": DEFAULT_LLM_APIKEY,
    "llm_model": DEFAULT_LLM_MODEL,
    "dingtalk_webhook": "",
    "dingtalk_secret": "",
    "auth_enabled": "true"
}


def init_configs(db: Session) -> None:
    """初始化默认配置"""
    for key, value in DEFAULT_CONFIGS.items():
        existing = db.query(Config).filter(Config.key == key).first()
        if not existing:
            config = Config(key=key, value=value, description=f"{key}配置")
            db.add(config)
    db.commit()


def get_config_value(db: Session, key: str) -> str:
    """获取单个配置值"""
    config = db.query(Config).filter(Config.key == key).first()
    if config:
        return config.value
    return DEFAULT_CONFIGS.get(key, "")


def set_config_value(db: Session, key: str, value: str) -> None:
    """设置单个配置值"""
    config = db.query(Config).filter(Config.key == key).first()
    if config:
        config.value = value
    else:
        config = Config(key=key, value=value)
        db.add(config)
    db.commit()


def get_all_configs(db: Session) -> ConfigResponse:
    """获取所有配置"""
    return ConfigResponse(
        llm_baseurl=get_config_value(db, "llm_baseurl"),
        llm_apikey=get_config_value(db, "llm_apikey"),
        llm_model=get_config_value(db, "llm_model"),
        dingtalk_webhook=get_config_value(db, "dingtalk_webhook"),
        dingtalk_secret=get_config_value(db, "dingtalk_secret"),
        auth_enabled=get_config_value(db, "auth_enabled").lower() == "true"
    )


def update_configs(db: Session, updates: ConfigUpdate) -> None:
    """更新配置"""
    if updates.llm_baseurl is not None:
        set_config_value(db, "llm_baseurl", updates.llm_baseurl)
    if updates.llm_apikey is not None:
        set_config_value(db, "llm_apikey", updates.llm_apikey)
    if updates.llm_model is not None:
        set_config_value(db, "llm_model", updates.llm_model)
    if updates.dingtalk_webhook is not None:
        set_config_value(db, "dingtalk_webhook", updates.dingtalk_webhook)
    if updates.dingtalk_secret is not None:
        set_config_value(db, "dingtalk_secret", updates.dingtalk_secret)
    if updates.auth_enabled is not None:
        set_config_value(db, "auth_enabled", "true" if updates.auth_enabled else "false")