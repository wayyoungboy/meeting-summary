from datetime import date

from app.models.meeting import Meeting

from conftest import auth_headers


def test_user_cannot_read_another_users_meeting(app_context):
    db = app_context["db"]
    meeting = Meeting(
        title="Bob's private meeting",
        meeting_date=date.today(),
        owner_id=app_context["other_user"].id,
        status="created",
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    response = app_context["client"].get(
        f"/api/meetings/{meeting.id}",
        headers=auth_headers("alice"),
    )

    assert response.status_code == 403


def test_meeting_response_does_not_expose_server_filesystem_paths(app_context):
    db = app_context["db"]
    meeting = Meeting(
        title="No path leak",
        meeting_date=date.today(),
        owner_id=app_context["user"].id,
        status="audio_uploaded",
        audio_path="/srv/meeting-summary/data/audio/private-recording.mp3",
        audio_filename="recording.mp3",
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    response = app_context["client"].get(
        f"/api/meetings/{meeting.id}",
        headers=auth_headers("alice"),
    )

    assert response.status_code == 200
    assert response.json()["audio_path"] == "private-recording.mp3"
    assert "/srv/" not in response.text


def test_audio_upload_enforces_streaming_size_limit(app_context, monkeypatch):
    from app.routers import meetings

    db = app_context["db"]
    upload_dir = app_context["tmp_path"] / "audio"
    upload_dir.mkdir()
    meeting = Meeting(
        title="Upload boundary",
        meeting_date=date.today(),
        owner_id=app_context["user"].id,
        status="created",
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    monkeypatch.setattr(meetings, "AUDIO_DIR", upload_dir)
    monkeypatch.setattr(meetings, "MAX_AUDIO_BYTES", 8)
    monkeypatch.setattr(meetings, "get_audio_duration", lambda _: 0)

    response = app_context["client"].post(
        f"/api/meetings/{meeting.id}/audio",
        headers=auth_headers("alice"),
        files={"file": ("meeting.mp3", b"more-than-eight-bytes", "audio/mpeg")},
    )

    assert response.status_code == 413
    assert list(upload_dir.iterdir()) == []
