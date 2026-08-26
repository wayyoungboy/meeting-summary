# Windows 部署

## 依赖

安装 Python 3.11+、Node.js 20+、pnpm 9+ 和 ffmpeg，并确保它们在 `PATH` 中。

## 初始化

在项目根目录打开 PowerShell：

```powershell
Copy-Item .env.example .env
Copy-Item frontend\.env.example frontend\.env.local

python -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
pip install -r backend\requirements-asr.txt
python download_models.py

Set-Location frontend
pnpm install --frozen-lockfile
Set-Location ..
```

编辑 `.env`，至少设置唯一的 `JWT_SECRET_KEY` 和 `DEFAULT_ADMIN_PASSWORD`。可用下面的命令生成 JWT 密钥：

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## 启动

双击 `start.bat`，或分别启动：

```powershell
# 终端 1
Set-Location backend
.venv\Scripts\Activate.ps1
python run.py

# 终端 2
Set-Location frontend
pnpm dev
```

打开 <http://localhost:13002>。后端 API 位于 <http://localhost:13001>。

## 常见问题

- PyTorch 安装失败：根据 CPU/CUDA 环境从 PyTorch 官方安装匹配版本的 `torch` 和 `torchaudio`。
- 找不到 ffmpeg：重新打开终端并运行 `ffmpeg -version` 检查 `PATH`。
- 转写失败：确认 `backend/models/` 下四个模型目录完整，并检查后端日志。
- 401：检查管理员密码或清除浏览器 Cookie 后重新登录。
- 端口冲突：修改 `.env` 的 `BACKEND_PORT`，同时修改 `frontend/.env.local` 的 `API_BASE_URL`；前端端口用 `PORT` 控制。

公网部署前请阅读根目录 [SECURITY.md](../SECURITY.md)，并使用 HTTPS 反向代理。
