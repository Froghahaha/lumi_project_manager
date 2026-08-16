# Repository Guidelines

## Project Structure & Module Organization

- `backend/app/` contains the FastAPI application, SQLModel data layer, authorization, lifecycle logic, and API routers.
- `backend/tests/` contains pytest tests and shared fixtures; tests use temporary SQLite databases and `TestClient`.
- `frontend/src/` contains the React/TypeScript UI. Reusable components live in `components/`, route views in `pages/`, and shared helpers in `utils/`.
- `docs/` contains product, architecture, development, and startup notes. `scripts/` contains import and server utilities.
- `build.ps1` packages the frontend and PyInstaller executable. Treat `backend/static/`, `build/`, `dist/`, logs, `uploads/`, and local `data.db` as generated or local runtime data.

## Build, Test, and Development Commands

From the repository root, install backend dependencies with `pip install -r backend/requirements.txt` and frontend dependencies with `cd frontend; npm install`.

- `cd frontend; npm run dev` starts the Vite development server on port 5173.
- `python -m uvicorn backend.app.main:app --reload --port 8000` starts the API with reload enabled.
- `cd frontend; npm run build` runs TypeScript checks and creates the production bundle.
- `cd frontend; npm run lint` runs ESLint; `cd frontend; npm test` runs Vitest once.
- `python -m pytest backend/tests` runs backend API tests. Install `pytest` separately if it is not already available.
- `./build.ps1` builds the frontend, copies static assets, and creates `dist/lumi_server.exe`; `./restart.ps1` starts both local processes.

## Coding Style & Naming Conventions

Use four spaces and `snake_case` for Python modules, functions, and variables; name backend tests `test_*.py`. Use two-space TypeScript indentation with no semicolons, PascalCase for React components, and camelCase for helpers and hooks (`use...`). Run ESLint before frontend submissions and keep API schemas, models, and routers aligned.

## Testing Guidelines

Add backend regression coverage with pytest and frontend utility/UI coverage with Vitest. Keep tests deterministic and isolated; do not depend on the local database. No coverage threshold is configured, so behavior changes should include focused tests where practical.

## Commit & Pull Request Guidelines

Recent commits use short descriptive subjects, sometimes Conventional Commit prefixes such as `feat:` or `feat(scope):`; follow that pattern and keep one logical change per commit. PRs should explain the behavior change, list validation commands, link an issue when available, and include screenshots for UI changes. Call out database, import, or packaging impacts explicitly.

## Security & Configuration Tips

Never commit real credentials, uploaded files, databases, logs, or build output. The documented default password is for development only; use controlled credentials and review authentication changes carefully.
