"""
任务推送路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.routers.auth import require_role
from app.services.dingtalk_service import push_tasks
from app.schemas.task import TaskPushRequest

router = APIRouter(prefix="/api/tasks", tags=["任务推送"])


@router.post("/push")
async def push_tasks_to_dingtalk(
    request: TaskPushRequest,
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """
    推送任务到钉钉（需要管理员权限）
    """
    if not request.task_ids:
        raise HTTPException(status_code=400, detail="请选择要推送的任务")

    result = await push_tasks(db, request.task_ids)
    return result
