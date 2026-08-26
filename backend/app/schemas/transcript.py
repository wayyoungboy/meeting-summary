"""
转写相关的Pydantic模型
"""
from pydantic import BaseModel
from typing import List, Optional


class TranscriptSegment(BaseModel):
    speaker: Optional[str] = None
    content: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    sequence: Optional[int] = None


class TranscriptResponse(BaseModel):
    meeting_id: int
    segments: List[TranscriptSegment]