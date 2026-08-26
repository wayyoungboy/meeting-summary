"""
任务相关的Pydantic模型
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class TaskResponse(BaseModel):
    id: int
    meeting_id: int
    content: str
    assignee: Optional[str] = None
    deadline: Optional[str] = None
    pushed: bool
    push_time: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskPushRequest(BaseModel):
    task_ids: List[int]


class TaskListResponse(BaseModel):
    meeting_id: int
    tasks: List[TaskResponse]