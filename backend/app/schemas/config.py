"""
系统配置相关的Pydantic模型
"""
from pydantic import BaseModel, Field, field_validator
import ipaddress
from typing import Optional
from urllib.parse import parse_qs, urlsplit


def validate_http_url(value: str, *, field_name: str) -> str:
    normalized = value.strip().rstrip("/")
    if not normalized:
        return normalized
    parsed = urlsplit(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"{field_name}必须是有效的HTTP(S)地址")
    if parsed.username or parsed.password:
        raise ValueError(f"{field_name}不能包含用户名或密码")
    is_loopback = parsed.hostname == "localhost"
    try:
        is_loopback = is_loopback or ipaddress.ip_address(parsed.hostname).is_loopback
    except ValueError:
        pass
    if parsed.scheme != "https" and not is_loopback:
        raise ValueError(f"{field_name}的远程地址必须使用HTTPS")
    return normalized


def validate_dingtalk_webhook(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        return normalized
    parsed = urlsplit(normalized)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "oapi.dingtalk.com"
        or parsed.path != "/robot/send"
        or not parse_qs(parsed.query).get("access_token")
    ):
        raise ValueError("钉钉Webhook必须使用官方HTTPS机器人地址")
    return normalized


class ConfigResponse(BaseModel):
    llm_baseurl: str
    llm_apikey: str
    llm_model: str
    dingtalk_webhook: str
    dingtalk_secret: str
    auth_enabled: bool


class ConfigUpdate(BaseModel):
    llm_baseurl: Optional[str] = Field(default=None, max_length=2048)
    llm_apikey: Optional[str] = Field(default=None, max_length=4096)
    llm_model: Optional[str] = Field(default=None, max_length=200)
    dingtalk_webhook: Optional[str] = Field(default=None, max_length=2048)
    dingtalk_secret: Optional[str] = Field(default=None, max_length=512)
    auth_enabled: Optional[bool] = None

    @field_validator("llm_baseurl")
    @classmethod
    def validate_llm_baseurl(cls, value):
        if value is None:
            return value
        return validate_http_url(value, field_name="LLM Base URL")

    @field_validator("dingtalk_webhook")
    @classmethod
    def validate_webhook(cls, value):
        if value is None:
            return value
        return validate_dingtalk_webhook(value)

    @field_validator("llm_apikey", "llm_model", "dingtalk_secret")
    @classmethod
    def strip_values(cls, value):
        return value.strip() if value is not None else value
