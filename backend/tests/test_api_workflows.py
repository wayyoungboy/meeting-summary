from datetime import date
from pathlib import Path

from app.models.meeting import Meeting
from app.models.transcript import Transcript
from app.models.user import User
from app.database import Base
from app.services.auth_service import verify_password
from app.services.config_service import get_config_value, init_configs

from conftest import auth_headers


def create_meeting(db, owner_id: int, **overrides) -> Meeting:
    meeting = Meeting(
        title=overrides.pop("title", "Weekly sync"),
        meeting_date=overrides.pop("meeting_date", date.today()),
        owner_id=owner_id,
        status=overrides.pop("status", "created"),
        **overrides,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def test_login_me_and_invalid_credentials(app_context):
    client = app_context["client"]

    failed = client.post(
        "/api/auth/login",
        json={"username": "alice", "password": "wrong-password"},
    )
    assert failed.status_code == 401

    login = client.post(
        "/api/auth/login",
        json={"username": "alice", "password": "alice-password"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "alice"
    assert me.json()["role"] == "user"

    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"}).status_code == 401


def test_admin_user_crud_and_stats(app_context):
    client = app_context["client"]
    admin_headers = auth_headers("admin")

    assert client.get("/api/admin/users", headers=auth_headers("alice")).status_code == 403

    created = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={"username": "charlie", "password": "charlie-password", "role": "user"},
    )
    assert created.status_code == 200
    user_id = created.json()["id"]

    duplicate = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={"username": "charlie", "password": "charlie-password", "role": "user"},
    )
    assert duplicate.status_code == 400

    updated = client.put(
        f"/api/admin/users/{user_id}",
        headers=admin_headers,
        json={"password": "updated-password", "role": "admin"},
    )
    assert updated.status_code == 200
    assert updated.json()["role"] == "admin"
    user = app_context["db"].query(User).filter(User.id == user_id).one()
    assert verify_password("updated-password", user.password_hash)

    for meeting_status in ("created", "audio_uploaded", "transcribing", "completed"):
        create_meeting(
            app_context["db"],
            app_context["user"].id,
            title=f"Meeting {meeting_status}",
            status=meeting_status,
        )

    stats = client.get("/api/admin/stats", headers=admin_headers)
    assert stats.status_code == 200
    assert stats.json()["total_users"] == 4
    assert stats.json()["total_meetings"] == 4
    assert stats.json()["completed_meetings"] == 1
    assert stats.json()["processing_meetings"] == 1
    assert stats.json()["pending_meetings"] == 2

    cannot_delete_self = client.delete(
        f"/api/admin/users/{app_context['admin'].id}", headers=admin_headers
    )
    assert cannot_delete_self.status_code == 400

    assert client.delete(f"/api/admin/users/{user_id}", headers=admin_headers).status_code == 200
    assert client.delete(f"/api/admin/users/{user_id}", headers=admin_headers).status_code == 404


def test_meeting_crud_is_scoped_to_the_owner(app_context):
    client = app_context["client"]
    alice_headers = auth_headers("alice")

    created = client.post(
        "/api/meetings",
        headers=alice_headers,
        json={
            "title": "Project kickoff",
            "meeting_date": "2026-08-27",
            "participants": ["Alice", "Bob"],
        },
    )
    assert created.status_code == 200
    meeting_id = created.json()["id"]

    own_list = client.get("/api/meetings", headers=alice_headers)
    assert own_list.status_code == 200
    assert [item["id"] for item in own_list.json()["items"]] == [meeting_id]

    bob_list = client.get("/api/meetings", headers=auth_headers("bob"))
    assert bob_list.json()["items"] == []

    updated = client.put(
        f"/api/meetings/{meeting_id}",
        headers=alice_headers,
        json={"title": "Updated kickoff", "participants": []},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Updated kickoff"
    assert updated.json()["participants"] == []

    admin_list = client.get("/api/meetings", headers=auth_headers("admin"))
    assert admin_list.json()["total"] == 1

    assert client.delete(f"/api/meetings/{meeting_id}", headers=alice_headers).status_code == 200
    assert client.get(f"/api/meetings/{meeting_id}", headers=alice_headers).status_code == 404


def test_create_meeting_rejects_blank_titles_and_invalid_dates(app_context):
    client = app_context["client"]
    headers = auth_headers("alice")

    blank_title = client.post(
        "/api/meetings",
        headers=headers,
        json={"title": "   ", "meeting_date": "2026-08-27"},
    )
    invalid_date = client.post(
        "/api/meetings",
        headers=headers,
        json={"title": "Planning", "meeting_date": "not-a-date"},
    )
    oversized_title = client.post(
        "/api/meetings",
        headers=headers,
        json={"title": "x" * 201, "meeting_date": "2026-08-27"},
    )

    assert blank_title.status_code == 422
    assert invalid_date.status_code == 422
    assert oversized_title.status_code == 422


def test_valid_audio_upload_replaces_old_file_and_delete_cleans_it_up(app_context, monkeypatch):
    from app.routers import meetings

    db = app_context["db"]
    upload_dir = app_context["tmp_path"] / "audio-files"
    upload_dir.mkdir()
    old_file = upload_dir / "old.mp3"
    old_file.write_bytes(b"old")
    meeting = create_meeting(
        db,
        app_context["user"].id,
        audio_path=str(old_file),
        audio_filename="old.mp3",
        status="audio_uploaded",
    )

    monkeypatch.setattr(meetings, "AUDIO_DIR", upload_dir)
    monkeypatch.setattr(meetings, "MAX_AUDIO_BYTES", 1024)
    monkeypatch.setattr(meetings, "get_audio_duration", lambda _: 12)

    uploaded = app_context["client"].post(
        f"/api/meetings/{meeting.id}/audio",
        headers=auth_headers("alice"),
        files={"file": ("new.mp3", b"new audio", "audio/mpeg")},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["audio_path"].endswith(".mp3")
    assert "/" not in uploaded.json()["audio_path"]
    assert not old_file.exists()

    db.refresh(meeting)
    new_file = meeting.audio_path
    assert new_file and upload_dir in Path(new_file).parents
    client_delete = app_context["client"].delete(
        f"/api/meetings/{meeting.id}", headers=auth_headers("alice")
    )
    assert client_delete.status_code == 200
    assert not Path(new_file).exists()


def test_transcript_summary_and_tasks_workflow(app_context, monkeypatch):
    db = app_context["db"]
    meeting = create_meeting(db, app_context["user"].id, status="completed")
    db.add(
        Transcript(
            meeting_id=meeting.id,
            speaker="说话人0",
            content="Alice will prepare the report by Friday.",
            start_time=0,
            end_time=3,
            sequence=1,
        )
    )
    db.commit()

    async def fake_llm(*_args, **_kwargs):
        return """## 会议主题
Weekly sync

## 待办任务
| 任务内容 | 负责人 | 截止日期 |
|---|---|---|
| Prepare report | Alice | Friday |
"""

    monkeypatch.setattr("app.services.llm_service.call_llm", fake_llm)
    headers = auth_headers("alice")

    transcript = app_context["client"].get(
        f"/api/meetings/{meeting.id}/transcript", headers=headers
    )
    assert transcript.status_code == 200
    assert transcript.json()["segments"][0]["speaker"] == "说话人0"

    summarized = app_context["client"].post(
        f"/api/meetings/{meeting.id}/summarize", headers=headers
    )
    assert summarized.status_code == 200

    summary = app_context["client"].get(
        f"/api/meetings/{meeting.id}/summary", headers=headers
    )
    assert summary.status_code == 200
    assert "Weekly sync" in summary.json()["content"]

    tasks = app_context["client"].get(
        f"/api/meetings/{meeting.id}/tasks", headers=headers
    )
    assert tasks.status_code == 200
    assert tasks.json()["tasks"][0]["content"] == "Prepare report"


def test_config_and_task_push_require_admin(app_context, monkeypatch):
    client = app_context["client"]
    admin_headers = auth_headers("admin")

    init_configs(app_context["db"])

    assert client.get("/api/config", headers=auth_headers("alice")).status_code == 403
    updated = client.put(
        "/api/config",
        headers=admin_headers,
        json={"llm_model": "test-model", "auth_enabled": True},
    )
    assert updated.status_code == 200
    assert get_config_value(app_context["db"], "llm_model") == "test-model"
    assert client.get("/api/config", headers=admin_headers).json()["llm_model"] == "test-model"
    assert client.get("/api/config/dingtalk-status").json() == {"configured": False}

    async def fake_push(_db, task_ids):
        return {"pushed_count": len(task_ids), "results": []}

    monkeypatch.setattr("app.routers.tasks.push_tasks", fake_push)
    assert client.post(
        "/api/tasks/push", headers=auth_headers("alice"), json={"task_ids": [1]}
    ).status_code == 403
    pushed = client.post(
        "/api/tasks/push", headers=admin_headers, json={"task_ids": [1, 2]}
    )
    assert pushed.status_code == 200
    assert pushed.json()["pushed_count"] == 2


def test_background_transcription_uses_an_isolated_database_session(tmp_path, monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import NullPool
    from app.routers import meetings

    database_path = tmp_path / "background.db"
    database_url = f"sqlite:///{database_path}"
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = Session()
    meeting = Meeting(title="Background", meeting_date=date.today(), status="audio_uploaded")
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    meeting_id = meeting.id
    db.close()

    monkeypatch.setattr(
        meetings,
        "transcribe_audio",
        lambda _path: [
            {
                "speaker": "A",
                "content": "done",
                "start_time": 0,
                "end_time": 1,
                "sequence": 1,
            }
        ],
    )

    meetings.process_transcription(meeting_id, "audio.wav", database_url)

    verify_db = Session()
    assert verify_db.query(Meeting).filter(Meeting.id == meeting_id).one().status == "completed"
    assert verify_db.query(Transcript).filter(Transcript.meeting_id == meeting_id).one().content == "done"
    verify_db.close()
    engine.dispose()
