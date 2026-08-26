import sys
from types import SimpleNamespace

import pytest

from app.services import asr_service
from app.services.asr_service import (
    format_transcript_text,
    get_audio_duration,
    get_transcript,
    save_transcript,
    transcribe_audio,
)
from app.services.dingtalk_service import push_task_to_dingtalk
from app.services.llm_service import call_llm, parse_tasks_from_summary, save_tasks
from app.services.config_service import set_config_value
from app.models.task import Task


def test_asr_sentence_info_is_normalized(monkeypatch):
    model = SimpleNamespace(
        generate=lambda **_: [
            {
                "sentence_info": [
                    {"spk": 2, "text": "hello", "start": 1500, "end": 2750}
                ]
            }
        ]
    )
    monkeypatch.setattr(asr_service, "load_asr_model", lambda: model)

    assert transcribe_audio("audio.wav") == [
        {
            "speaker": "说话人2",
            "content": "hello",
            "start_time": 1.5,
            "end_time": 2.75,
            "sequence": 1,
        }
    ]


def test_asr_timestamp_fallback_and_error(monkeypatch):
    model = SimpleNamespace(
        generate=lambda **_: [{"text": "hello", "timestamp": [[1000, 2400]]}]
    )
    monkeypatch.setattr(asr_service, "load_asr_model", lambda: model)
    segment = transcribe_audio("audio.wav")[0]
    assert segment["start_time"] == 1.0
    assert segment["end_time"] == 2.4

    monkeypatch.setattr(
        asr_service,
        "load_asr_model",
        lambda: SimpleNamespace(generate=lambda **_: []),
    )
    with pytest.raises(RuntimeError, match="语音转写失败"):
        transcribe_audio("audio.wav")


def test_transcript_persistence_and_formatting(app_context):
    db = app_context["db"]
    meeting_id = 999
    # SQLite test fixtures enable foreign keys only on the application engine,
    # so this unit-level persistence test can focus on transcript ordering.
    segments = [
        {"speaker": "B", "content": "second", "start_time": 2, "end_time": 3, "sequence": 2},
        {"speaker": "A", "content": "first", "start_time": 0, "end_time": 1, "sequence": 1},
    ]
    save_transcript(db, meeting_id, segments)
    loaded = get_transcript(db, meeting_id)

    assert [item["content"] for item in loaded] == ["first", "second"]
    assert format_transcript_text(loaded) == "A: first\nB: second"


def test_audio_duration_uses_torchaudio(monkeypatch):
    waveform = SimpleNamespace(shape=(1, 32_000))
    monkeypatch.setitem(
        sys.modules,
        "torchaudio",
        SimpleNamespace(load=lambda _: (waveform, 16_000)),
    )
    assert get_audio_duration("audio.wav") == 2


def test_task_parsing_and_replacement(app_context):
    content = """## 待办任务
| 任务内容 | 负责人 | 截止日期 |
|---|---|---|
| Ship release | Alice | Friday |

## 其他备注
Done
"""
    parsed = parse_tasks_from_summary(content)
    assert parsed == [{"content": "Ship release", "assignee": "Alice", "deadline": "Friday"}]

    save_tasks(app_context["db"], 100, parsed)
    save_tasks(
        app_context["db"],
        100,
        [{"content": "Replacement", "assignee": None, "deadline": None}],
    )
    tasks = app_context["db"].query(Task).all()
    assert [task.content for task in tasks] == ["Replacement"]


@pytest.mark.asyncio
async def test_llm_success_response(app_context, monkeypatch):
    set_config_value(app_context["db"], "llm_baseurl", "https://llm.example/v1")
    set_config_value(app_context["db"], "llm_apikey", "test-key")
    set_config_value(app_context["db"], "llm_model", "test-model")

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "summary"}}]}

    class Client:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, **kwargs):
            assert url == "https://llm.example/v1/chat/completions"
            assert kwargs["headers"]["Authorization"] == "Bearer test-key"
            return Response()

    monkeypatch.setattr("app.services.llm_service.httpx.AsyncClient", Client)
    assert await call_llm(app_context["db"], "prompt") == "summary"


@pytest.mark.asyncio
async def test_dingtalk_success_response(app_context, monkeypatch):
    set_config_value(
        app_context["db"],
        "dingtalk_webhook",
        "https://oapi.dingtalk.com/robot/send?access_token=test",
    )

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"errcode": 0}

    class Client:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, **kwargs):
            assert url.startswith("https://oapi.dingtalk.com/robot/send")
            assert kwargs["json"]["msgtype"] == "text"
            return Response()

    monkeypatch.setattr("app.services.dingtalk_service.httpx.AsyncClient", Client)
    assert await push_task_to_dingtalk(
        app_context["db"], "Weekly", "Ship", "Alice", "Friday"
    )
