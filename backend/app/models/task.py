from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    assignee: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    deadline: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    pushed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    push_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
