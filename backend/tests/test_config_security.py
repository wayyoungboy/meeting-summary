import pytest
from pydantic import ValidationError

from app.schemas.config import ConfigUpdate
from app.services.config_service import set_config_value
from app.services.dingtalk_service import push_task_to_dingtalk
from app.services.llm_service import LLMConfigurationError, call_llm


@pytest.mark.parametrize(
    "webhook",
    [
        "http://oapi.dingtalk.com/robot/send?access_token=test",
        "https://127.0.0.1/robot/send?access_token=test",
        "https://example.com/robot/send?access_token=test",
    ],
)
def test_dingtalk_webhook_rejects_non_dingtalk_targets(webhook):
    with pytest.raises(ValidationError):
        ConfigUpdate(dingtalk_webhook=webhook)


def test_dingtalk_webhook_accepts_official_https_endpoint():
    config = ConfigUpdate(
        dingtalk_webhook="https://oapi.dingtalk.com/robot/send?access_token=test"
    )

    assert config.dingtalk_webhook.startswith("https://oapi.dingtalk.com/robot/send")


def test_remote_llm_endpoint_requires_https_but_localhost_http_is_allowed():
    with pytest.raises(ValidationError):
        ConfigUpdate(llm_baseurl="http://example.com/v1")

    config = ConfigUpdate(llm_baseurl="http://127.0.0.1:11434/v1")
    assert config.llm_baseurl == "http://127.0.0.1:11434/v1"


@pytest.mark.asyncio
async def test_llm_missing_api_key_fails_before_network_request(app_context):
    with pytest.raises(LLMConfigurationError, match="API Key"):
        await call_llm(app_context["db"], "hello")


@pytest.mark.asyncio
async def test_legacy_unsafe_webhook_is_blocked_at_request_boundary(app_context, monkeypatch):
    attempted_network_request = False

    class UnexpectedClient:
        def __init__(self, *args, **kwargs):
            nonlocal attempted_network_request
            attempted_network_request = True

    set_config_value(app_context["db"], "dingtalk_webhook", "https://127.0.0.1/robot/send")
    monkeypatch.setattr("app.services.dingtalk_service.httpx.AsyncClient", UnexpectedClient)

    pushed = await push_task_to_dingtalk(
        app_context["db"],
        meeting_title="Private",
        task_content="Do not send",
    )

    assert pushed is False
    assert attempted_network_request is False
