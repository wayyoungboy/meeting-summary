"""
智能会议纪要系统 - 后端启动脚本
"""
import os
from pathlib import Path

import uvicorn
from dotenv import load_dotenv

# 仓库根目录的 .env（与 app.config 一致）。必须在读取 BACKEND_HOST/PORT/APP_ENV 之前加载。
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

if __name__ == "__main__":
    is_development = os.getenv("APP_ENV", "development").lower() not in {
        "production",
        "prod",
    }
    uvicorn.run(
        "app.main:app",
        host=os.getenv("BACKEND_HOST", "0.0.0.0"),
        port=int(os.getenv("BACKEND_PORT", "13001")),
        reload=is_development,
        reload_dirs=["app"] if is_development else None,
    )
