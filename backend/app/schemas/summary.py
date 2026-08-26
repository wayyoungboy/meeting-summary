"""
纪要相关的Pydantic模型
"""
from pydantic import BaseModel
from datetime import datetime


class SummaryResponse(BaseModel):
    id: int
    meeting_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True