import hashlib

from app.models.user import User
from app.services.auth_service import (
    authenticate_user,
    get_password_hash,
    password_needs_rehash,
    verify_password,
)
from app.services.config_service import set_config_value

from conftest import auth_headers


def test_passwords_use_salted_scrypt_hashes():
    first = get_password_hash("same-password")
    second = get_password_hash("same-password")

    assert first.startswith("scrypt$")
    assert first != second
    assert verify_password("same-password", first)
    assert not verify_password("wrong-password", first)


def test_legacy_sha256_hash_is_upgraded_after_successful_login(app_context):
    db = app_context["db"]
    legacy_hash = hashlib.sha256(b"legacy-password").hexdigest()
    legacy_user = User(username="legacy", password_hash=legacy_hash, role="user")
    db.add(legacy_user)
    db.commit()

    authenticated = authenticate_user(db, "legacy", "legacy-password")
    db.refresh(legacy_user)

    assert authenticated is not None
    assert not password_needs_rehash(legacy_user.password_hash)
    assert legacy_user.password_hash.startswith("scrypt$")


def test_user_can_change_password_and_old_password_stops_working(app_context):
    client = app_context["client"]
    response = client.post(
        "/api/auth/change-password",
        headers=auth_headers("alice"),
        json={
            "oldPassword": "alice-password",
            "newPassword": "a-new-secure-password",
        },
    )

    assert response.status_code == 200
    assert authenticate_user(app_context["db"], "alice", "alice-password") is None
    assert authenticate_user(app_context["db"], "alice", "a-new-secure-password") is not None


def test_admin_api_rejects_unknown_roles(app_context):
    response = app_context["client"].post(
        "/api/admin/users",
        headers=auth_headers("admin"),
        json={"username": "mallory", "password": "strong-password", "role": "owner"},
    )

    assert response.status_code == 422


def test_last_admin_cannot_demote_themselves(app_context):
    admin = app_context["admin"]
    response = app_context["client"].put(
        f"/api/admin/users/{admin.id}",
        headers=auth_headers("admin"),
        json={"role": "user"},
    )

    assert response.status_code == 400
    app_context["db"].refresh(admin)
    assert admin.role == "admin"


def test_disabling_auth_preserves_valid_admin_access(app_context):
    client = app_context["client"]
    set_config_value(app_context["db"], "auth_enabled", "false")

    assert client.get("/api/meetings").status_code == 200
    assert client.get("/api/config").status_code == 403
    assert client.get("/api/config", headers=auth_headers("admin")).status_code == 200

    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "correct-horse-battery-staple"},
    )
    token = login.json()["access_token"]
    assert client.get(
        "/api/config", headers={"Authorization": f"Bearer {token}"}
    ).status_code == 200
