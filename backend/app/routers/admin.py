"""
管理员路由
"""
from pydantic import BaseModel, field_validator
from typing import Literal, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.routers.auth import require_role
from app.models.user import User
from app.services.auth_service import get_password_hash

router = APIRouter(prefix="/api/admin", tags=["管理员"])


class UserCreate(BaseModel):
    username: str
    password: str
    role: Literal["admin", "user"] = "user"

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("用户名至少2个字符")
        if len(v) > 50:
            raise ValueError("用户名不能超过50个字符")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("密码至少8个字符")
        if len(v) > 256:
            raise ValueError("密码不能超过256个字符")
        return v


class UserUpdate(BaseModel):
    password: Optional[str] = None
    role: Optional[Literal["admin", "user"]] = None

    @field_validator("password")
    @classmethod
    def validate_optional_password(cls, value):
        if value is not None and not 8 <= len(value) <= 256:
            raise ValueError("密码长度必须为8到256个字符")
        return value


class AdminUserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total_users: int
    total_meetings: int
    completed_meetings: int
    processing_meetings: int
    pending_meetings: int


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """获取用户列表（管理员）"""
    users = db.query(User).order_by(desc(User.created_at)).all()
    return [AdminUserResponse.model_validate(u) for u in users]


@router.post("/users", response_model=AdminUserResponse)
def create_user(
    user_data: UserCreate,
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """创建用户（管理员）"""
    # 检查用户名是否已存在
    existing = db.query(User).filter(User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    user = User(
        username=user_data.username,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AdminUserResponse.model_validate(user)


@router.put("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """更新用户信息（管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if user.role == "admin" and user_data.role == "user":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="至少需要保留一个管理员")

    if user_data.password:
        user.password_hash = get_password_hash(user_data.password)
    if user_data.role is not None:
        user.role = user_data.role

    db.commit()
    db.refresh(user)

    return AdminUserResponse.model_validate(user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """删除用户（管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")

    db.delete(user)
    db.commit()

    return {"message": "deleted"}


@router.get("/stats")
def get_stats(
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """获取系统统计信息（管理员）"""
    from app.models.meeting import Meeting

    total_users = db.query(User).count()
    total_meetings = db.query(Meeting).count()
    completed = db.query(Meeting).filter(Meeting.status == "completed").count()
    processing = db.query(Meeting).filter(Meeting.status == "transcribing").count()
    pending = (
        db.query(Meeting)
        .filter(Meeting.status.in_(["created", "audio_uploaded"]))
        .count()
    )

    return {
        "total_users": total_users,
        "total_meetings": total_meetings,
        "completed_meetings": completed,
        "processing_meetings": processing,
        "pending_meetings": pending,
    }
