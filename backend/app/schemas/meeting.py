"""
会议相关的Pydantic模型
"""
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from typing import Optional, List
import json
from pathlib import Path


class MeetingCreate(BaseModel):
    title: str = Field(max_length=200)
    meeting_date: str  # YYYY-MM-DD格式
    participants: Optional[List[str]] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value

    @field_validator("meeting_date")
    @classmethod
    def validate_meeting_date(cls, value: str) -> str:
        date.fromisoformat(value)
        return value


class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    meeting_date: Optional[str] = None
    participants: Optional[List[str]] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value

    @field_validator("meeting_date")
    @classmethod
    def validate_meeting_date(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            date.fromisoformat(value)
        return value


class MeetingResponse(BaseModel):
    id: int
    title: str
    meeting_date: str
    participants: Optional[List[str]] = None
    audio_path: Optional[str] = None
    audio_filename: Optional[str] = None
    audio_filesize: Optional[int] = None
    duration: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_validator("meeting_date", mode="before")
    @classmethod
    def format_meeting_date(cls, v):
        if isinstance(v, date):
            return v.isoformat()
        return v

    @field_validator("participants", mode="before")
    @classmethod
    def parse_participants(cls, v):
        if isinstance(v, str):
            return json.loads(v) if v else None
        return v

    @field_validator("audio_path", mode="before")
    @classmethod
    def hide_server_audio_path(cls, value):
        """Expose only a file identifier, never the server's absolute path."""
        return Path(value).name if value else None

    class Config:
        from_attributes = True


class MeetingListResponse(BaseModel):
    items: List[MeetingResponse]
    total: int
    page: int
    size: int
