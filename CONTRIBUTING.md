# Contributing

Thanks for helping improve Meeting Summary.

## Development setup

1. Use Python 3.11+, Node.js 20+, and pnpm 9+.
2. Install backend development dependencies with `pip install -r backend/requirements-dev.txt`.
3. Install frontend dependencies with `cd frontend && pnpm install --frozen-lockfile`.
4. Copy `.env.example` to `.env` and `frontend/.env.example` to `frontend/.env.local`.

The ASR stack is optional for most API development. Install `backend/requirements-asr.txt` and download the models only when working on transcription.

## Before opening a pull request

Run these checks:

```bash
cd backend
ruff check app tests
pytest --cov=app --cov-report=term-missing --cov-fail-under=80

cd ../frontend
pnpm lint
pnpm typecheck
pnpm audit --registry=https://registry.npmjs.org/ --audit-level=moderate
pnpm build
```

Add regression tests for bug fixes. Never commit `.env` files, databases, audio recordings, model weights, API keys, JWT secrets, or webhook URLs.
