"""
智能会议纪要系统 - FastAPI主入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import CORS_ORIGINS
from app.database import init_db, SessionLocal
from app.services.auth_service import init_admin_user
from app.services.config_service import init_configs
from app.routers import auth, meetings, tasks, config, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    """
    # 启动时初始化数据库和默认数据
    init_db()
    db = SessionLocal()
    try:
        init_admin_user(db)
        init_configs(db)
    finally:
        db.close()

    yield

    # 关闭时清理资源
    print("Application shutting down...")


app = FastAPI(
    title="智能会议纪要系统",
    description="会议音频转写、智能纪要生成、任务推送",
    version="1.0.0",
    lifespan=lifespan
)

# CORS配置 - 允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response

# 注册路由
app.include_router(auth.router)
app.include_router(meetings.router)
app.include_router(tasks.router)
app.include_router(config.router)
app.include_router(admin.router)


@app.get("/")
def root():
    """
    根路径
    """
    return {"message": "智能会议纪要系统 API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    """
    健康检查
    """
    return {"status": "healthy"}
