# Meeting Summary / 智能会议纪要

一个面向自托管场景的会议音频转写与纪要系统：上传音频后使用 FunASR 做中文语音识别和说话人区分，再通过 OpenAI 兼容接口生成会议纪要与待办任务，并可推送到钉钉机器人。

## 功能

- 多用户登录与管理员权限
- 会议创建、查询、更新和删除
- 音频上传、大小限制与本地存储
- FunASR 本地转写和说话人区分
- OpenAI 兼容 LLM 纪要生成
- 待办任务提取与钉钉机器人推送
- SQLite 本地数据库

## 架构

浏览器只访问 Next.js。Next.js 的 Route Handlers 作为 BFF，将 HttpOnly Cookie 中的登录令牌转发给 FastAPI；FastAPI 负责权限、数据、音频、ASR、LLM 和钉钉集成。

```text
Browser -> Next.js :13002 -> FastAPI :13001 -> SQLite / audio files
                                      -> FunASR local models
                                      -> LLM API / DingTalk
```

## 环境要求

- Python 3.11+
- Node.js 20.9+
- pnpm 9+
- ffmpeg
- 建议至少 16 GB 内存和 20 GB 可用磁盘（完整 ASR 模型）

## 快速开始

先获取代码，后续命令默认在仓库根目录执行。

```text
git clone https://github.com/wayyoungboy/meeting-summary.git
cd meeting-summary
```

后端环境文件 `.env` 必须位于仓库根目录（与 `.env.example` 同级），不是 `backend/`。

### 1. 配置后端

```bash
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

把生成值写入 `.env` 的 `JWT_SECRET_KEY`，并在首次启动前设置 `DEFAULT_ADMIN_PASSWORD`。生产环境必须设置 `APP_ENV=production`。

### 2. 安装后端与模型

```bash
python3.11 -m venv backend/.venv
source backend/.venv/bin/activate       # Windows: backend\.venv\Scripts\activate
pip install -r backend/requirements-asr.txt
python download_models.py
```

如果只开发 API、不需要本地转写，可安装较轻量的 `backend/requirements-dev.txt`。

PyTorch 的安装方式会因 CPU、CUDA 和操作系统而不同。如果默认安装失败，请按 PyTorch 官方方式安装一组版本匹配的 `torch` / `torchaudio`，再安装其余依赖。

### 3. 安装前端

```bash
cp frontend/.env.example frontend/.env.local
cd frontend
pnpm install --frozen-lockfile
```

### 4. 启动

终端一：

```bash
cd backend
source .venv/bin/activate
python run.py
```

终端二：

```bash
cd frontend
pnpm dev
```

打开 <http://localhost:13002>。管理员用户名为 `admin`；密码来自 `DEFAULT_ADMIN_PASSWORD`。开发环境未配置密码时，首次创建管理员会在后端日志打印一次随机密码。

Windows 部署请看 [docs/DEPLOY_WINDOWS.md](docs/DEPLOY_WINDOWS.md)，配置完成后可运行 start.bat。

## 配置

登录管理员账号后，可在“系统设置”中配置：

- LLM Base URL、API Key 和模型名
- 钉钉机器人 Webhook 与加签密钥
- 是否启用认证

远程 LLM 地址要求 HTTPS；仅 loopback 地址允许 HTTP，便于连接本机 Ollama。钉钉 Webhook 只接受官方 HTTPS 机器人地址。

## 数据目录

- `data/database.db`：SQLite 数据库
- `data/audio/`：上传的会议音频
- `backend/models/`：FunASR 模型

这些路径都已加入 `.gitignore`。备份时应同时备份数据库和音频目录，并按敏感数据处理。

## 开发与验证

```bash
cd backend
pip install -r requirements-dev.txt
ruff check app tests
pytest --cov=app --cov-report=term-missing --cov-fail-under=80

cd ../frontend
pnpm lint
pnpm typecheck
pnpm audit --registry=https://registry.npmjs.org/ --audit-level=moderate
pnpm build
```

更多协作说明见 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。

## 部署注意事项

- 使用 HTTPS 反向代理，不要直接把开发服务器暴露到公网。
- 在反向代理层配置登录限流、请求体限制和访问日志脱敏。
- SQLite 适合单机部署；多实例部署前应迁移数据库并引入共享任务队列。
- ASR 当前在 FastAPI 后台任务中执行，重启进程会中断正在进行的转写。

## 端口与常见问题

- 前端默认 http://localhost:13002，后端 API 默认 http://localhost:13001。
- 改后端端口时同步修改根目录 .env 的 BACKEND_PORT 与 frontend/.env.local 的 API_BASE_URL。
- 改前端端口时修改 frontend/.env.local 的 PORT。
- JWT_SECRET_KEY 至少 32 个字符；生产环境必须设置 APP_ENV=production。
- 前端必须使用仓库声明的包管理器安装依赖。
- 不做本地转写时，安装 backend 的开发依赖即可，不必下载 ASR 模型。
- 转写失败时检查 ffmpeg、backend/models/ 四个模型目录，以及后端日志。

## 开源许可证

本项目采用 [MIT License](LICENSE)。
