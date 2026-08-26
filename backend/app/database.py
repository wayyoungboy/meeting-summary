"""
数据库连接与会话管理
"""
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_PATH

# SQLite数据库连接
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite需要此配置
)


@event.listens_for(engine, "connect")
def enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库，创建所有表"""
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)

    migrations = {
        "users": {
            "role": "ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'",
        },
        "meetings": {
            "owner_id": "ALTER TABLE meetings ADD COLUMN owner_id INTEGER",
            "audio_filename": "ALTER TABLE meetings ADD COLUMN audio_filename VARCHAR(255)",
            "audio_filesize": "ALTER TABLE meetings ADD COLUMN audio_filesize INTEGER",
        },
    }

    with engine.begin() as conn:
        schema = inspect(conn)
        for table_name, columns in migrations.items():
            if not schema.has_table(table_name):
                continue
            existing = {column["name"] for column in schema.get_columns(table_name)}
            for column_name, statement in columns.items():
                if column_name not in existing:
                    conn.execute(text(statement))

    # 为旧会议回填owner_id（分配给第一个管理员用户）
    with engine.begin() as conn:
        admin = conn.execute(
            text("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1")
        ).fetchone()
        if admin:
            conn.execute(
                text("UPDATE meetings SET owner_id = :admin_id WHERE owner_id IS NULL"),
                {"admin_id": admin[0]},
            )
