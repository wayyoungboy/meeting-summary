# Frontend

Next.js 16 BFF 与 Web UI。完整安装、配置和运行方式请看项目根目录的 [README](../README.md)。

常用命令：

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

只使用 `pnpm`；`pnpm-lock.yaml` 是唯一的前端锁文件。浏览器请求同源 `/api/*`，服务端通过 `API_BASE_URL` 连接 FastAPI。
