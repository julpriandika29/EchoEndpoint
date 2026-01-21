# Repository Overview
- This is a FastAPI service that generates unique webhook endpoints, captures incoming HTTP requests, and stores them in a local SQLite database. A browser dashboard renders a split-pane UI with a request list and detailed inspector, similar to webhook.site.
- The core request capture flow is handled in `app/main.py`, which persists request metadata, raw bodies, and headers, then broadcasts events over SSE to live dashboards.
- The system serves HTML templates and static assets directly from the FastAPI app without a build step.
- Webhook responses default to `200` with `{"message":"ok"}` and can be overridden per token via `/api/endpoints/{token}/response` with status code, body text, and content type.

# Tech Stack
- Python version: Not found (searched `README.md`, `requirements.txt`, and repo root for version pins).
- FastAPI version: Not pinned; `fastapi` is listed in `requirements.txt`.
- Dependency manager/tooling: `pip` with `requirements.txt`; `uvicorn` listed in `requirements.txt` and used in `README.md`.
- Database: SQLite via raw `sqlite3` in `app/db.py` with manual SQL.
- Frontend/dashboard: Server-rendered Jinja2 templates in `app/templates/` and static assets in `app/static/`; no build tooling.

# Directory Map
- `app/`
- `app/__init__.py` (package marker)
- `app/main.py` (FastAPI app, routes, SSE, rate limiting)
- `app/db.py` (SQLite connection + schema creation)
- `app/models.py` (field name lists, not referenced elsewhere)
- `app/services/sse.py` (SSE broadcaster abstraction)
- `app/templates/index.html` (home page)
- `app/templates/dashboard.html` (dashboard page)
- `app/static/styles.css` (dashboard styling)
- `app/static/app.js` (dashboard logic, API + SSE)
- `app/static/js/` (modular dashboard scripts: API, requests, SSE, toasts, modals, response settings)
- `app/static/css/` (modular CSS for base/layout/components/utilities)
- `requirements.txt`
- `README.md`
- Not found: `docs/` before this file, `tests/`, `migrations/`, `pyproject.toml`.

# Runtime & Deployment
- Local run steps in `README.md`:
- `python -m venv .venv`
- `.\.venv\Scripts\Activate.ps1`
- `pip install -r requirements.txt`
- `uvicorn app.main:app --reload`
- Environment variables/config: Not found (searched `README.md` and repo root for `.env` or config files).
- Containerization/deployment: Not found (no `Dockerfile`, `docker-compose.yml`, or systemd/k8s manifests).

# Backend Architecture
- App initialization: `app/main.py` creates `app = FastAPI()`, mounts static files, and registers templates.
- Routing: All routes are defined in `app/main.py` (no separate routers).
- Models/validation: No Pydantic models; endpoints return dicts via `JSONResponse` and `HTTPException` for errors.
- Error handling: Explicit 404/429 responses in handlers; no global exception handlers or middleware.

# Persistence Layer (SQLite)
- Schema definition: `app/db.py` via `init_db()` with `CREATE TABLE IF NOT EXISTS` for `endpoints` and `requests`.
- Additional tables: `webhook_response_config` for per-token response status/body configuration.
- Migrations: Not found; schema is created on startup in `app/main.py` via `@app.on_event("startup")`.
- Data access: Inline SQL in `app/main.py`; `app/models.py` holds field name lists but is not used.
- Connection lifecycle: `get_connection()` returns a new `sqlite3.Connection` with `check_same_thread=False`; each handler opens and closes a connection.

# SSE Broadcasting
- SSE endpoint: `GET /events/{token}` in `app/main.py`.
- Event model: `event: request_received` with JSON payload `{id, received_at, method, path}`.
- Channel structure: Per-token queues in `app/services/sse.py` (`SSEBroadcaster` uses `asyncio.Queue` per subscriber).
- Production of events: `webhook_receiver` calls `broadcaster.broadcast()` after persisting a request.
- Concurrency/backpressure: Async queues, broadcast awaits `queue.put()`; keep-alive ping every 15s via `: ping` comments; no explicit reconnect logic beyond SSE defaults.

# Dashboard UI
- UI location: Jinja2 templates in `app/templates/` and static assets in `app/static/`.
- Pages/routes: `/` renders `app/templates/index.html`; `/e/{token}` renders `app/templates/dashboard.html`.
- Data sources: `app/static/app.js` calls `/api/endpoints/{token}/requests`, `/api/requests/{id}`, `/api/endpoints/{token}/clear`, `/api/endpoints/{token}/export`, `/api/endpoints/{token}/response`, and subscribes to `/events/{token}`.
- Response settings: `/e/{token}` includes a response configuration panel with status code and content type dropdowns plus a raw body editor; body is stored as text.
- UI behavior: request list scrollbars are visually hidden but remain scrollable, modal and dropdown option scrollbars are hidden while preserving scroll, long paths are truncated with ellipsis, clearing requests uses a confirmation modal and resets the detail inspector to an empty state without leaving stale data, the webhook URL is copied by clicking the input with toast-only feedback (no inline indicator), response settings open in a modal from the topbar that starts hidden and closes via the close button, backdrop click, or Escape, Load More shows a toast with the number of requests loaded, and save/reset/clear actions trigger top-right toasts that auto-dismiss with a countdown bar.
- Auth/session: Not found; dashboard relies on token in URL; no cookies/sessions.

# Frontend Asset Structure
- Entry point: `app/static/app.js` bootstraps the dashboard using native ES modules.
- JS modules: feature and utility modules live in `app/static/js/` (API calls, request list rendering, SSE setup, toasts, modals, response settings).
- CSS structure: `app/static/styles.css` loads modular styles from `app/static/css/` (base, layout, components, utilities) via `@import`.
- Build step: Not found; assets are served directly without bundling.

# Testing & Quality
- Tests: Not found (no `tests/` directory or test dependencies).
- Lint/format/typecheck: Not found (no `pyproject.toml`, `setup.cfg`, or tool configs).
- CI: Not found (no `.github/workflows/`).

# Security & Auth
- Auth: None; access is based solely on possession of the endpoint token.
- Rate limiting: In-memory `RateLimiter` in `app/main.py` for IP and token.
- CORS/CSRF: Not configured (no CORS middleware).
- Secrets: Tokens generated with `secrets.token_urlsafe(32)`.
- XSS surface: UI uses `textContent` for request data in `app/static/app.js` (safer), but request contents are still rendered client-side; no server-side sanitization noted.

# Observability
- Logging: Not configured beyond default Uvicorn/FastAPI logging.
- Metrics/tracing: Not found.
- Health checks: Not found.

# Known Gaps / TODOs
- No tests or CI configuration.
- No configuration system or environment variable documentation.
- `app/models.py` appears unused.
- No explicit pagination limits or max offset guards in `list_requests`.
- No data retention policy or pruning for SQLite.
- `app/static/app.js` includes a non-ASCII character in the `detailMeta` string (potential typo).

# Suggested Next Actions
- Add a minimal config layer (env vars) for DB path, rate limits, and body size caps.
- Add request list pagination limits and a max cap to avoid large offsets.
- Add basic tests for webhook capture, SSE event emission, and API list/detail endpoints.
- Add CORS config if this will be accessed from other origins.
- Add structured logging around request capture and SSE broadcast failures.
- Add data retention controls (auto-prune older requests).
- Remove or use `app/models.py` to avoid dead code.
- Add a health endpoint (e.g., `/healthz`) for deployment checks.
