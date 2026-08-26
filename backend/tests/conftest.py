import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool


os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-key-that-is-at-least-32-characters")
os.environ.setdefault("DEFAULT_ADMIN_PASSWORD", "test-admin-password")

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.config import Config  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.auth_service import get_password_hash  # noqa: E402


@pytest.fixture()
def app_context(tmp_path: Path):
    database_path = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{database_path}",
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSession()
    admin = User(
        username="admin",
        password_hash=get_password_hash("correct-horse-battery-staple"),
        role="admin",
    )
    user = User(
        username="alice",
        password_hash=get_password_hash("alice-password"),
        role="user",
    )
    other_user = User(
        username="bob",
        password_hash=get_password_hash("bob-password"),
        role="user",
    )
    db.add_all(
        [
            admin,
            user,
            other_user,
            Config(key="auth_enabled", value="true"),
        ]
    )
    db.commit()
    for record in (admin, user, other_user):
        db.refresh(record)

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    yield {
        "client": client,
        "db": db,
        "admin": admin,
        "user": user,
        "other_user": other_user,
        "tmp_path": tmp_path,
    }

    client.close()
    app.dependency_overrides.clear()
    db.close()
    engine.dispose()


def auth_headers(username: str) -> dict[str, str]:
    from app.services.auth_service import create_access_token

    return {"Authorization": f"Bearer {create_access_token(username)}"}
