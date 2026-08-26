"""
钉钉推送服务
"""
import logging
import time
import hmac
import hashlib
import base64
import urllib.parse
import httpx
from datetime import datetime
from sqlalchemy.orm import Session
from app.services.config_service import get_config_value
from app.models.task import Task
from app.models.meeting import Meeting
from app.schemas.config import validate_dingtalk_webhook

logger = logging.getLogger(__name__)


async def push_task_to_dingtalk(
    db: Session,
    meeting_title: str,
    task_content: str,
    assignee: str = "待定",
    deadline: str = "待定"
) -> bool:
    """
    推送单个任务到钉钉

    Args:
        db: 数据库会话
        meeting_title: 会议标题
        task_content: 任务内容
        assignee: 负责人
        deadline: 截止日期

    Returns:
        是否成功推送
    """
    webhook = get_config_value(db, "dingtalk_webhook")
    secret = get_config_value(db, "dingtalk_secret")

    if not webhook:
        logger.warning("钉钉Webhook未配置")
        return False

    try:
        webhook = validate_dingtalk_webhook(webhook)
    except ValueError:
        logger.error("Blocked an invalid DingTalk webhook configuration")
        return False

    # 构建URL（如果有secret则加签）
    url = webhook
    if secret:
        timestamp = str(round(time.time() * 1000))
        string_to_sign = f'{timestamp}\n{secret}'
        hmac_code = hmac.new(
            secret.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            digestmod=hashlib.sha256
        ).digest()
        sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
        url = f"{webhook}&timestamp={timestamp}&sign={sign}"

    # 构建钉钉消息（文本格式，包含关键词"负责人"）
    message = {
        "msgtype": "text",
        "text": {
            "content": f"""【会议待办任务】
会议：{meeting_title}
任务：{task_content}
负责人：{assignee}
截止日期：{deadline}"""
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            response = await client.post(url, json=message)
            response.raise_for_status()

            data = response.json()
            if data.get("errcode") == 0:
                logger.info("Task pushed to DingTalk successfully")
                return True
            else:
                logger.error("DingTalk push failed with errcode=%s", data.get("errcode"))
                return False

    except (httpx.HTTPError, ValueError, TypeError) as exc:
        logger.error("DingTalk push error: %s", type(exc).__name__)
        return False


async def push_tasks(db: Session, task_ids: list) -> dict:
    """
    推送多个任务到钉钉

    Args:
        db: 数据库会话
        task_ids: 任务ID列表

    Returns:
        推送结果 {"pushed_count": ..., "results": [...]}
    """
    results = []
    pushed_count = 0

    for task_id in task_ids:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            results.append({"task_id": task_id, "success": False, "message": "任务不存在"})
            continue

        meeting = db.query(Meeting).filter(Meeting.id == task.meeting_id).first()
        meeting_title = meeting.title if meeting else "未知会议"

        success = await push_task_to_dingtalk(
            db,
            meeting_title,
            task.content,
            task.assignee or "待定",
            task.deadline or "待定"
        )

        if success:
            task.pushed = True
            task.push_time = datetime.now()
            db.commit()
            pushed_count += 1
            results.append({"task_id": task_id, "success": True, "message": "推送成功"})
        else:
            results.append({"task_id": task_id, "success": False, "message": "推送失败"})

    return {"pushed_count": pushed_count, "results": results}
