"""
大语言模型服务 - OpenAI兼容接口
"""
import logging
import httpx
from sqlalchemy.orm import Session
from app.services.config_service import get_config_value
from app.models.summary import Summary
from app.models.task import Task
from app.schemas.config import validate_http_url

logger = logging.getLogger(__name__)


class LLMConfigurationError(RuntimeError):
    """Raised when the configured LLM endpoint cannot be used safely."""

# 纪要生成Prompt模板
SUMMARY_PROMPT_TEMPLATE = """你是一位专业的会议纪要整理助手。请根据以下会议转写内容生成结构化的会议纪要。

会议标题：{meeting_title}
会议日期：{meeting_date}
参会人员：{participants}

转写内容：
{transcript_content}

请按以下格式输出会议纪要：

## 会议主题
[简要概括会议主题，不超过50字]

## 参会人员
[列出实际参与讨论的人员，如果转写中有说话人标识则使用]

## 讨论要点
1. [要点1]
2. [要点2]
3. [要点3]
...

## 决议事项
- [决议1]
- [决议2]
...

## 待办任务
请按表格格式列出所有待办任务：
| 任务内容 | 负责人 | 截止日期 |
|---|---|---|
| [任务1] | [负责人] | [日期] |
| [任务2] | [负责人] | [日期] |

注意：
1. 截止日期请推断或使用"待定"
2. 负责人请根据转写内容推断，如无法确定则使用"待定"
3. 任务内容要具体明确

## 其他备注
[如有其他重要信息请列出]
"""


async def call_llm(
    db: Session,
    prompt: str,
    max_tokens: int = 2000
) -> str:
    """
    调用LLM API

    Args:
        db: 数据库会话
        prompt: 输入提示词
        max_tokens: 最大输出token数

    Returns:
        LLM返回的文本
    """
    baseurl = get_config_value(db, "llm_baseurl")
    apikey = get_config_value(db, "llm_apikey")
    model = get_config_value(db, "llm_model")

    if not baseurl:
        raise LLMConfigurationError("请先配置LLM Base URL")
    try:
        baseurl = validate_http_url(baseurl, field_name="LLM Base URL")
    except ValueError as exc:
        raise LLMConfigurationError(str(exc)) from exc
    if not apikey:
        raise LLMConfigurationError("请先配置LLM API Key")
    if not model:
        raise LLMConfigurationError("请先配置LLM模型")

    url = f"{baseurl}/chat/completions"

    headers = {
        "Authorization": f"Bearer {apikey}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": max_tokens
    }

    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=False) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise ValueError("empty LLM response")
            return content

    except LLMConfigurationError:
        raise
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.error("LLM call failed: %s", type(exc).__name__)
        raise RuntimeError("LLM调用失败，请检查服务地址、模型和密钥配置") from exc


async def generate_summary(
    db: Session,
    meeting_id: int,
    meeting_title: str,
    meeting_date: str,
    participants: str,
    transcript_text: str
) -> str:
    """
    生成会议纪要

    Args:
        db: 数据库会话
        meeting_id: 会议ID
        meeting_title: 会议标题
        meeting_date: 会议日期
        participants: 参会人员
        transcript_text: 转写文本

    Returns:
        生成的纪要内容
    """
    prompt = SUMMARY_PROMPT_TEMPLATE.format(
        meeting_title=meeting_title,
        meeting_date=meeting_date,
        participants=participants if participants else "未知",
        transcript_content=transcript_text
    )

    summary_content = await call_llm(db, prompt)

    # 保存纪要到数据库
    existing = db.query(Summary).filter(Summary.meeting_id == meeting_id).first()
    if existing:
        existing.content = summary_content
    else:
        summary = Summary(meeting_id=meeting_id, content=summary_content)
        db.add(summary)
    db.commit()

    return summary_content


def parse_tasks_from_summary(summary_content: str) -> list:
    """
    从纪要中解析待办任务

    Args:
        summary_content: 纪要内容

    Returns:
        任务列表 [{"content": ..., "assignee": ..., "deadline": ...}]
    """
    tasks = []

    # 找到待办任务部分
    lines = summary_content.split("\n")
    in_task_section = False

    for line in lines:
        if "## 待办任务" in line or "## 待办事项" in line:
            in_task_section = True
            continue

        if in_task_section:
            if line.startswith("##") and "待办" not in line:
                break

            # 解析表格行
            if line.startswith("|") and not line.startswith("|---"):
                parts = line.split("|")
                parts = [p.strip() for p in parts if p.strip()]

                if len(parts) >= 3 and parts[0] not in ["任务内容", "任务"]:
                    task = {
                        "content": parts[0],
                        "assignee": parts[1] if len(parts) > 1 else "待定",
                        "deadline": parts[2] if len(parts) > 2 else "待定"
                    }
                    tasks.append(task)

    return tasks


def save_tasks(db: Session, meeting_id: int, tasks: list) -> None:
    """
    保存任务到数据库

    Args:
        db: 数据库会话
        meeting_id: 会议ID
        tasks: 任务列表
    """
    # 清除旧任务
    db.query(Task).filter(Task.meeting_id == meeting_id).delete()

    # 保存新任务
    for task in tasks:
        new_task = Task(
            meeting_id=meeting_id,
            content=task.get("content", ""),
            assignee=task.get("assignee"),
            deadline=task.get("deadline"),
            pushed=False
        )
        db.add(new_task)

    db.commit()
