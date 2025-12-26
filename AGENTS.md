# Repository Guidelines

## Project Structure & Module Organization
- `backend/` houses the FastAPI service. Main package is `backend/src/rs485_app/` with `api/` (routers), `domain/` (core logic), and `infra/` (DB/RS-485 integrations). Tests live in `backend/tests/`.
- `frontend/` is the Vite + React UI. Source is under `frontend/src/` with pages, components, and shared libs.
- `desktop/` is the Tauri app. The Rust side lives in `desktop/src-tauri/`, with JS tooling driven by `desktop/package.json`.
- Root-level config includes `docker-compose.yml`, `Dockerfile`, and `.env.example` for local setup.

## Build, Test, and Development Commands
- Backend dev server: `cd backend && uv sync --dev && uv run uvicorn rs485_app.main:app --reload --host 0.0.0.0 --port 8000`
- Run migrations: `cd backend && uv run alembic -c alembic.ini upgrade head`
- Backend tests: `cd backend && uv run pytest`
- Frontend dev server: `cd frontend && npm ci && npm run dev`
- Frontend build: `cd frontend && npm run build`
- Desktop dev: `cd desktop && npm ci && npm run dev`
- Desktop build: `cd desktop && npm run build` (requires a bundled backend sidecar in `desktop/src-tauri/bin/`)

## Coding Style & Naming Conventions
- Python: use `ruff` and `black` settings from `pyproject.toml` (line length 100, strict typing). Prefer `snake_case` for functions/vars and `PascalCase` for classes.
- TypeScript/React: follow `eslint` defaults; use `PascalCase` for components and `camelCase` for hooks and utilities.
- Keep files and folders aligned to existing layout (e.g., new API routes under `backend/src/rs485_app/api/routers/`).

## Testing Guidelines
- Tests are currently minimal; place new backend tests under `backend/tests/` using `test_*.py` or `*_test.py` and run with `pytest`.
- If you add frontend or desktop tests, document the command in `AGENTS.md` and keep test files near the feature they cover.

## Commit & Pull Request Guidelines
- Recent history shows a mix of merge commits and Conventional Commit-style messages (`feat:`, `fix:`, `ci:`). Prefer `type(scope): summary` when possible.
- PRs should include: a brief description, linked issues (if any), and screenshots for UI changes. Call out any schema or migration updates explicitly.

## Configuration & Secrets
- Copy `.env.example` to `.env` where needed and keep secrets out of Git. Common entries include `backend/.env` for `DATABASE_URL` and `frontend/.env` for `VITE_API_BASE`.
