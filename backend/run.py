"""
智能会议纪要系统 - 后端启动脚本
"""
import os

import uvicorn

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
