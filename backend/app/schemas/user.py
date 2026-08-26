"""
用户相关的Pydantic模型
"""
from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime


class UserLogin(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip()


class PasswordChange(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    old_password: str = Field(alias="oldPassword", min_length=1, max_length=256)
    new_password: str = Field(alias="newPassword", min_length=8, max_length=256)


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
