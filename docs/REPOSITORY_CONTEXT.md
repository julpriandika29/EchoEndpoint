# Repository Overview
- FastAPI service that generates unique webhook endpoints, captures inbound HTTP requests, and stores them in local SQLite. A server-rendered dashboard provides a split-pane (desktop) or toggle-based (mobile) UI to inspect requests in real time.
- Core capture flow: `/wh/{token}` persists request metadata/body in SQLite, updates endpoint `last_seen_at`, and broadcasts a `request_received` SSE event to all dashboard subscribers.
- The app serves Jinja2 templates and static assets directly (no build step) and supports per-token response overrides via `/api/endpoints/{token}/response`.

# Tech Stack
- Python: Not pinned in repo; runtime assumed via `python -m venv` and `uvicorn` in `README.md`.
- Backend: FastAPI + Uvicorn, Jinja2 templates.
- Database: SQLite via stdlib `sqlite3` (no ORM).
- Frontend: server-rendered HTML + native ES modules + modular CSS (imported via `app/static/styles.css`).
- Release tooling: PyInstaller via GitHub Actions for Linux bundles.

# Directory Map
- `app/`
- `app/main.py` (FastAPI app, routes, rate limiting, SSE, request capture)
- `app/cli.py` (CLI entrypoint: `echoendpoint [serve]` with `--host`/`--port`)
- `app/db.py` (SQLite connection + schema creation)
- `app/models.py` (field name lists; unused)
- `app/services/sse.py` (SSE broadcaster)
- `app/templates/index.html` (home page)
- `app/templates/dashboard.html` (dashboard page)
- `app/static/app.js` (ESM bootstrap)
- `app/static/js/` (feature modules: API, requests, SSE, toasts, modals, response settings)
- `app/static/styles.css` (CSS entrypoint)
- `app/static/css/` (base/layout/components/utilities)
- `.github/workflows/build-release.yml` (Linux bundle build + GitHub Release)
- `requirements.txt`
- `README.md`
- `data.db` (SQLite DB file in repo root)

# Runtime & Deployment
- Local run (from `README.md`):
  - `python -m venv .venv`
  - `.\.venv\Scripts\Activate.ps1`
  - `pip install -r requirements.txt`
  - `uvicorn app.main:app --reload`
- CLI entrypoint: `app/cli.py` supports `echoendpoint serve --host --port` and defaults to `HOST`/`PORT` env vars (fallback 0.0.0.0:8000).
- DB location: `data.db` at repo root (see `app/db.py`); delete to reset data.
- Release workflow: `/.github/workflows/build-release.yml` builds a Debian-compatible Linux bundle inside `python:3.11-slim-bullseye` using Docker, packages `dist/echoendpoint` into `echoendpoint-linux-amd64-<YYYYMMDD>-<shortsha>.tar.gz`, and publishes a GitHub Release on `release` branch pushes.

# Backend Architecture
- App init (`app/main.py`): creates `FastAPI()`, resolves template/static paths via `get_app_dir()` for PyInstaller (`sys._MEIPASS`), mounts `/static`, and initializes DB on startup.
- Routing: all routes are defined in `app/main.py`.
- Rate limiting: in-memory `RateLimiter` keyed by IP and token (120/min per IP, 240/min per token).
- Webhook capture: `/wh/{token}` supports all common HTTP methods, truncates body >1MB, stores headers/body metadata, and returns a per-token custom response if configured.
- Response override: `resolve_response_config()` reads `webhook_response_config` to return custom status/body/content-type.

# Persistence Layer (SQLite)
- Schema: created in `app/db.py` via `init_db()` (`CREATE TABLE IF NOT EXISTS`).
- Tables: `endpoints`, `requests`, `webhook_response_config`.
- Connection lifecycle: `get_connection()` opens a new `sqlite3.Connection` per handler with `check_same_thread=False`; callers close connections explicitly.
- Migrations: none; schema is created on startup via `@app.on_event("startup")` in `app/main.py`.

# SSE Broadcasting
- Endpoint: `GET /events/{token}` in `app/main.py`.
- Event model: `event: request_received` with JSON payload `{id, received_at, method, path}`.
- Broadcaster: `app/services/sse.py` uses per-token `asyncio.Queue` sets; events are queued and emitted to each subscriber.
- Heartbeat: keep-alive `: ping` comment every 15s via `asyncio.wait_for` timeout.

# Dashboard UI
- Pages/routes: `/` renders `app/templates/index.html`; `/e/{token}` renders `app/templates/dashboard.html`.
- Data sources: ES modules call `/api/endpoints/{token}/requests`, `/api/requests/{id}`, `/api/endpoints/{token}/clear`, `/api/endpoints/{token}/export`, `/api/endpoints/{token}/response`, and subscribe to `/events/{token}`.
- Response settings: modal for per-token status/body/content-type; save/reset uses token-scoped APIs.
- UI behavior: hidden scrollbars (scrollable), ellipsis truncation for long paths, clear confirmation modal, toasts (save/reset/clear/load-more/copy), click-to-copy webhook URL, and response settings modal with Escape/backdrop close.
- Responsive: desktop split-pane; mobile uses Requests/Details toggle with a back button; toggle shrink-wraps to button height on mobile and spacing is clamped via `.panel` grid rules and `#mobile-toggle + .list-panel` in `app/static/css/layout.css`.

# API Overview
- Public pages:
  - `GET /` (home)
  - `POST /create` (create token, redirect to dashboard)
  - `GET /e/{token}` (dashboard)
- Webhook:
  - `/wh/{token}` (GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD)
- SSE:
  - `GET /events/{token}`
- Requests API:
  - `GET /api/endpoints/{token}/requests?limit=&offset=`
  - `GET /api/requests/{id}`
  - `POST /api/endpoints/{token}/clear`
  - `GET /api/endpoints/{token}/export`
- Response config:
  - `GET /api/endpoints/{token}/response`
  - `PUT /api/endpoints/{token}/response`
  - `DELETE /api/endpoints/{token}/response`

# Local Development
- Install deps with `pip install -r requirements.txt`.
- Run server with `uvicorn app.main:app --reload`.
- Visit `/` to create a token and `/e/{token}` to open the dashboard.

# Common Tasks
- Add a new API route: edit `app/main.py` and update the dashboard JS if needed.
- Add a new DB table: update `app/db.py` schema and adjust read/write SQL in `app/main.py`.
- Add a new SSE event: update `app/services/sse.py` (payload structure) and `app/main.py` to broadcast, then handle in `app/static/js/sse.js`.
- Add a dashboard widget: update `app/templates/dashboard.html` and `app/static/js/` modules; add styles in `app/static/css/`.

# Troubleshooting
- SQLite locked: ensure no concurrent writers (single-process recommended); delete `data.db` for a clean slate.
- SSE disconnects: verify `/events/{token}` and proxies that buffer SSE (set `X-Accel-Buffering: no`).
- PyInstaller import errors: ensure `--collect-submodules app` is used (see workflow) and that `app/cli.py` imports `app.main` at runtime.

# Security & Auth
- Auth: none; access is by possession of the token.
- Rate limiting: in-memory IP and token limits in `app/main.py`.
- CORS/CSRF: not configured.
- Tokens: generated with `secrets.token_urlsafe(32)`.

# Observability
- Logging: default Uvicorn/FastAPI logging only.
- Metrics/tracing: not configured.
- Health checks: none.

# Testing & Quality
- Tests: none found (`tests/` absent).
- Lint/format/typecheck: no config files present.
- CI: GitHub Actions build/release workflow in `.github/workflows/build-release.yml`.

# Known Gaps / TODOs
- No tests or CI for unit/integration beyond release build.
- No configuration layer for DB path, rate limits, or body size cap.
- `app/models.py` unused.
- `app/static/js/requests.js` contains a non-ASCII glyph in the detail meta line (likely a typo).

# Suggested Next Actions
- Add a minimal configuration system (env vars) for DB path, rate limits, and body size caps.
- Add tests for webhook capture, SSE emission, and response config APIs.
- Add pagination bounds (max `limit`/`offset`) in `list_requests`.
- Add a health endpoint (e.g., `/healthz`).
- Clean up the non-ASCII glyph in `requests.js` and re-verify UI rendering.
