"""
会议管理路由
"""
import os
import logging
import uuid
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.config import AUDIO_DIR, MAX_AUDIO_BYTES
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.meeting import Meeting
from app.models.summary import Summary
from app.models.task import Task
from app.services.asr_service import (
    transcribe_audio, save_transcript, get_transcript,
    format_transcript_text, get_audio_duration
)
from app.services.llm_service import generate_summary, parse_tasks_from_summary, save_tasks
from app.schemas.meeting import (
    MeetingCreate, MeetingUpdate, MeetingResponse, MeetingListResponse
)

router = APIRouter(prefix="/api/meetings", tags=["会议管理"])
logger = logging.getLogger(__name__)


def check_meeting_ownership(meeting: Meeting, current_user: User) -> bool:
    """检查用户是否有权限访问该会议（管理员或有拥有者）"""
    if current_user.role == "admin":
        return True
    return meeting.owner_id == current_user.id


def process_transcription(meeting_id: int, audio_path: str, db_url: str):
    """
    后台任务：处理语音转写
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # 更新状态为转写中
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if meeting:
            meeting.status = "transcribing"
            db.commit()

        # 执行转写
        segments = transcribe_audio(audio_path)

        # 保存转写结果
        save_transcript(db, meeting_id, segments)

        # 更新状态为完成
        if meeting:
            meeting.status = "completed"
            db.commit()

    except Exception:
        logger.exception("Transcription failed for meeting %s", meeting_id)
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if meeting:
            meeting.status = "error"
            db.commit()
    finally:
        db.close()
        engine.dispose()


@router.get("", response_model=MeetingListResponse)
def list_meetings(
    page: int = 1,
    size: int = 10,
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取会议列表（管理员看全部，普通用户只看自己的）
    """
    if page < 1 or size < 1 or size > 100:
        raise HTTPException(status_code=400, detail="分页参数无效")

    query = db.query(Meeting)

    # 普通用户只能看自己的会议
    if current_user.role != "admin":
        query = query.filter(Meeting.owner_id == current_user.id)

    if status:
        query = query.filter(Meeting.status == status)

    if keyword:
        query = query.filter(Meeting.title.contains(keyword))

    total = query.count()
    items = query.order_by(desc(Meeting.created_at)).offset((page - 1) * size).limit(size).all()

    return MeetingListResponse(
        items=[MeetingResponse.model_validate(m) for m in items],
        total=total,
        page=page,
        size=size
    )


@router.post("", response_model=MeetingResponse)
def create_meeting(
    meeting_data: MeetingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    创建会议
    """
    participants_str = None
    if meeting_data.participants:
        import json
        participants_str = json.dumps(meeting_data.participants)

    meeting = Meeting(
        title=meeting_data.title,
        meeting_date=date.fromisoformat(meeting_data.meeting_date),
        participants=participants_str,
        status="created",
        owner_id=current_user.id,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    return MeetingResponse.model_validate(meeting)


@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取会议详情
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not check_meeting_ownership(meeting, current_user):
        raise HTTPException(status_code=403, detail="无权访问此会议")

    return MeetingResponse.model_validate(meeting)


@router.put("/{meeting_id}", response_model=MeetingResponse)
def update_meeting(
    meeting_id: int,
    meeting_data: MeetingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新会议信息
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not check_meeting_ownership(meeting, current_user):
        raise HTTPException(status_code=403, detail="无权修改此会议")

    if meeting_data.title is not None:
        meeting.title = meeting_data.title
    if meeting_data.meeting_date is not None:
        meeting.meeting_date = date.fromisoformat(meeting_data.meeting_date)
    if meeting_data.participants is not None:
        import json
        meeting.participants = json.dumps(meeting_data.participants)

    meeting.updated_at = datetime.now()
    db.commit()
    db.refresh(meeting)

    return MeetingResponse.model_validate(meeting)


@router.delete("/{meeting_id}")
def delete_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除会议
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not check_meeting_ownership(meeting, current_user):
        raise HTTPException(status_code=403, detail="无权删除此会议")

    # 删除关联的文件
    if meeting.audio_path and os.path.exists(meeting.audio_path):
        os.remove(meeting.audio_path)

    # 删除关联数据
    db.query(Summary).filter(Summary.meeting_id == meeting_id).delete()
    db.query(Task).filter(Task.meeting_id == meeting_id).delete()

    # 删除转写记录
    from app.models.transcript import Transcript
    db.query(Transcript).filter(Transcript.meeting_id == meeting_id).delete()

    db.delete(meeting)
    db.commit()

    return {"message": "deleted"}


@router.post("/{meeting_id}/audio")
def upload_audio(
    meeting_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    上传音频文件（不自动启动转写）
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not check_meeting_ownership(meeting, current_user):
        raise HTTPException(status_code=403, detail="无权操作此会议")

    original_filename = file.filename or ""
    allowed_extensions = {".mp3", ".wav", ".m4a", ".ogg"}
    allowed_types = {
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/x-wav",
        "audio/ogg",
        "audio/x-m4a",
        "audio/mp4",
    }
    file_ext = os.path.splitext(original_filename)[1].lower()
    if file_ext not in allowed_extensions or file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="不支持的音频格式")

    # 保存文件
    file_name = f"{meeting_id}_{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(AUDIO_DIR, file_name)

    # 流式写入并限制大小，避免大文件耗尽服务器内存或磁盘。
    file_size = 0
    try:
        with open(file_path, "xb") as output:
            while chunk := file.file.read(1024 * 1024):
                file_size += len(chunk)
                if file_size > MAX_AUDIO_BYTES:
                    raise HTTPException(status_code=413, detail="音频文件过大")
                output.write(chunk)
    except Exception:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise
    finally:
        file.file.close()

    # 获取音频时长
    duration = get_audio_duration(file_path)

    # 更新会议记录（保存原始文件名和文件大小）
    old_audio_path = meeting.audio_path
    meeting.audio_path = file_path
    meeting.audio_filename = original_filename
    meeting.audio_filesize = file_size
    meeting.duration = duration
    meeting.status = "audio_uploaded"  # 音频已上传，等待转写
    db.commit()

    if old_audio_path and old_audio_path != file_path and os.path.exists(old_audio_path):
        os.remove(old_audio_path)

    return {
        "id": meeting_id,
        "audio_path": file_name,
        "audio_filename": original_filename,
        "audio_filesize": file_size,
        "duration": duration,
        "status": "audio_uploaded"
    }


@router.get("/{meeting_id}/transcript")
def get_meeting_transcript(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取会议转写结果
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not check_meeting_ownership(meeting, current_user):
        raise HTTPException(status_code=403, detail="无权访问此会议")

    segments = get_transcript(db, meeting_id)
    return {"meeting_id": meeting_id, "segments": segments}


@router.post("/{meeting_id}/transcribe")
def start_transcription(
    meeting_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    手动启动语音转写
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not check_meeting_ownership(meeting, current_user):
        raise HTTPException(status_code=403, detail="无权操作此会议")

    if not meeting.audio_path:
        raise HTTPException(status_code=400, detail="请先上传音频文件")

    if meeting.status == "transcribing":
        raise HTTPException(status_code=400, detail="转写正在进行中")

    if meeting.status == "completed":
        raise HTTPException(status_code=400, detail="转写已完成")

    # 更新状态为转写中
    meeting.status = "transcribing"
    db.commit()

    # 启动后台转写任务
    from app.config import DATABASE_PATH
    db_url = f"sqlite:///{DATABASE_PATH}"
    background_tasks.add_task(process_transcription, meeting_id, meeting.audio_path, db_url)

    return {"id": meeting_id, "status": "transcribing", "message": "转写任务已启动"}


@router.post("/{meeting_id}/summarize")
async def summarize_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    生成会议纪要
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not check_meeting_ownership(meeting, current_user):
        raise HTTPException(status_code=403, detail="无权操作此会议")

    if meeting.status != "completed":
        raise HTTPException(status_code=400, detail="转写未完成，无法生成纪要")

    # 获取转写文本
    segments = get_transcript(db, meeting_id)
    transcript_text = format_transcript_text(segments)

    if not transcript_text:
        raise HTTPException(status_code=400, detail="转写内容为空")

    # 获取参会人员
    participants = meeting.participants
    if participants:
        import json
        try:
            participants = json.dumps(json.loads(participants))
        except (json.JSONDecodeError, TypeError):
            participants = meeting.participants

    # 生成纪要
    summary_content = await generate_summary(
        db, meeting_id, meeting.title, meeting.meeting_date, participants, transcript_text
    )

    # 解析并保存任务
    tasks = parse_tasks_from_summary(summary_content)
    save_tasks(db, meeting_id, tasks)

    return {"message": "summary generated", "meeting_id": meeting_id}


@router.get("/{meeting_id}/summary")
def get_meeting_summary(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取会议纪要
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not check_meeting_ownership(meeting, current_user):
        raise HTTPException(status_code=403, detail="无权访问此会议")

    summary = db.query(Summary).filter(Summary.meeting_id == meeting_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="纪要未生成")

    return {"id": summary.id, "meeting_id": summary.meeting_id, "content": summary.content, "created_at": summary.created_at}


@router.get("/{meeting_id}/tasks")
def get_meeting_tasks(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取会议待办任务
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    if not check_meeting_ownership(meeting, current_user):
        raise HTTPException(status_code=403, detail="无权访问此会议")

    tasks = db.query(Task).filter(Task.meeting_id == meeting_id).all()
    task_list = [
        {
            "id": t.id,
            "meeting_id": t.meeting_id,
            "content": t.content,
            "assignee": t.assignee,
            "deadline": t.deadline,
            "pushed": t.pushed,
            "push_time": t.push_time
        }
        for t in tasks
    ]

    return {"meeting_id": meeting_id, "tasks": task_list}
