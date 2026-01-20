import asyncio
import base64
import json
import os
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Deque, Dict, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.db import get_connection, init_db
from app.services.sse import SSEBroadcaster

APP_DIR = Path(__file__).resolve().parent
MAX_BODY_BYTES = 1_048_576


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def allow(self, key: str) -> bool:
        now = time.monotonic()
        async with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window_seconds:
                hits.popleft()
            if len(hits) >= self.max_requests:
                return False
            hits.append(now)
            return True


app = FastAPI()
templates = Jinja2Templates(directory=str(APP_DIR / "templates"))
app.mount("/static", StaticFiles(directory=str(APP_DIR / "static")), name="static")

broadcaster = SSEBroadcaster()
ip_limiter = RateLimiter(max_requests=120, window_seconds=60)
token_limiter = RateLimiter(max_requests=240, window_seconds=60)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_endpoint_by_token(token: str) -> Optional[dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM endpoints WHERE token = ?", (token,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_response_config(token: str) -> Optional[dict]:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT token, status_code, body_json, content_type, updated_at "
            "FROM webhook_response_config WHERE token = ?",
            (token,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def validate_status_code(status_code: int) -> bool:
    return 100 <= status_code <= 599


def resolve_response_config(token: str) -> dict:
    default_body = {"message": "ok"}
    default_status = 200
    config = get_response_config(token)
    if not config:
        return {"status_code": default_status, "body": default_body}

    status_code = config.get("status_code", default_status)
    if not isinstance(status_code, int) or not validate_status_code(status_code):
        return {"status_code": default_status, "body": default_body}

    body_json = config.get("body_json", "")
    try:
        body = json.loads(body_json)
    except (TypeError, json.JSONDecodeError):
        return {"status_code": default_status, "body": default_body}

    return {"status_code": status_code, "body": body}


def require_admin(request: Request) -> None:
    admin_key = os.getenv("ADMIN_API_KEY")
    if not admin_key:
        raise HTTPException(status_code=403, detail="Admin API disabled")
    provided = request.headers.get("x-api-key")
    if provided != admin_key:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/", response_class=HTMLResponse)
def home(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/create")
def create_endpoint() -> RedirectResponse:
    conn = get_connection()
    try:
        token = None
        for _ in range(5):
            candidate = secrets.token_urlsafe(32)
            try:
                conn.execute(
                    "INSERT INTO endpoints (token, created_at) VALUES (?, ?)",
                    (candidate, utc_now()),
                )
                conn.commit()
                token = candidate
                break
            except sqlite3.IntegrityError:
                continue
        if not token:
            raise HTTPException(status_code=500, detail="Unable to create endpoint")
    finally:
        conn.close()
    return RedirectResponse(url=f"/e/{token}", status_code=303)


@app.get("/e/{token}", response_class=HTMLResponse)
def dashboard(request: Request, token: str) -> HTMLResponse:
    endpoint = get_endpoint_by_token(token)
    if not endpoint:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    base_url = str(request.base_url).rstrip("/")
    webhook_url = f"{base_url}/wh/{token}"
    context = {"request": request, "token": token, "webhook_url": webhook_url}
    return templates.TemplateResponse("dashboard.html", context)


@app.api_route(
    "/wh/{token}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def webhook_receiver(request: Request, token: str) -> Response:
    endpoint = get_endpoint_by_token(token)
    if not endpoint:
        return JSONResponse(status_code=404, content={"error": "Unknown endpoint"})

    client_ip = request.client.host if request.client else "unknown"
    if not await ip_limiter.allow(client_ip):
        return JSONResponse(status_code=429, content={"error": "Rate limit exceeded"})
    if not await token_limiter.allow(token):
        return JSONResponse(status_code=429, content={"error": "Rate limit exceeded"})

    raw_body = await request.body()
    body_size = len(raw_body)
    truncated = 0
    body_blob = raw_body
    if body_size > MAX_BODY_BYTES:
        truncated = 1
        body_blob = raw_body[:MAX_BODY_BYTES]

    body_text: Optional[str] = None
    if body_blob:
        try:
            body_text = body_blob.decode("utf-8", errors="replace")
        except Exception:
            body_text = None

    headers_json = json.dumps(dict(request.headers))
    content_type = request.headers.get("content-type")
    user_agent = request.headers.get("user-agent")
    query = request.url.query
    received_at = utc_now()

    conn = get_connection()
    try:
        cur = conn.execute(
            """
            INSERT INTO requests (
                endpoint_id,
                received_at,
                method,
                path,
                query,
                headers_json,
                body_blob,
                body_text,
                content_type,
                remote_ip,
                user_agent,
                truncated,
                body_size
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                endpoint["id"],
                received_at,
                request.method,
                request.url.path,
                query,
                headers_json,
                body_blob,
                body_text,
                content_type,
                client_ip,
                user_agent,
                truncated,
                body_size,
            ),
        )
        conn.execute(
            "UPDATE endpoints SET last_seen_at = ? WHERE id = ?",
            (received_at, endpoint["id"]),
        )
        conn.commit()
        request_id = cur.lastrowid
    finally:
        conn.close()

    await broadcaster.broadcast(
        token,
        {
            "id": request_id,
            "received_at": received_at,
            "method": request.method,
            "path": request.url.path,
        },
    )

    response_config = resolve_response_config(token)
    status_code = response_config["status_code"]
    body = response_config["body"]

    if request.method == "HEAD":
        return Response(status_code=status_code)
    return JSONResponse(content=body, status_code=status_code)


@app.get("/events/{token}")
async def sse_events(token: str) -> StreamingResponse:
    endpoint = get_endpoint_by_token(token)
    if not endpoint:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    queue = await broadcaster.register(token)

    async def event_generator():
        try:
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15)
                    data = json.dumps(payload)
                    yield f"event: request_received\ndata: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            await broadcaster.unregister(token, queue)

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)


@app.get("/api/endpoints/{token}/requests")
def list_requests(token: str, limit: int = 200, offset: int = 0) -> JSONResponse:
    endpoint = get_endpoint_by_token(token)
    if not endpoint:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, received_at, method, path, query, content_type, remote_ip,
                   user_agent, truncated, body_size
            FROM requests
            WHERE endpoint_id = ?
            ORDER BY id DESC
            LIMIT ? OFFSET ?
            """,
            (endpoint["id"], limit, offset),
        ).fetchall()
        items = [dict(row) for row in rows]
    finally:
        conn.close()

    return JSONResponse(content={"items": items, "limit": limit, "offset": offset})


@app.get("/api/requests/{request_id}")
def request_detail(request_id: int) -> JSONResponse:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")
        data = dict(row)
    finally:
        conn.close()

    body_blob = data.get("body_blob") or b""
    data["body_blob_base64"] = base64.b64encode(body_blob).decode("ascii")
    data.pop("body_blob", None)
    return JSONResponse(content=data)


@app.post("/api/endpoints/{token}/clear")
def clear_requests(token: str) -> JSONResponse:
    endpoint = get_endpoint_by_token(token)
    if not endpoint:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    conn = get_connection()
    try:
        conn.execute("DELETE FROM requests WHERE endpoint_id = ?", (endpoint["id"],))
        conn.commit()
    finally:
        conn.close()

    return JSONResponse(content={"ok": True})


@app.get("/api/endpoints/{token}/export")
def export_requests(token: str) -> Response:
    endpoint = get_endpoint_by_token(token)
    if not endpoint:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM requests WHERE endpoint_id = ? ORDER BY id DESC",
            (endpoint["id"],),
        ).fetchall()
        items = []
        for row in rows:
            item = dict(row)
            body_blob = item.get("body_blob") or b""
            item["body_blob_base64"] = base64.b64encode(body_blob).decode("ascii")
            item.pop("body_blob", None)
            items.append(item)
    finally:
        conn.close()

    payload = {
        "endpoint": {
            "token": endpoint["token"],
            "created_at": endpoint["created_at"],
            "last_seen_at": endpoint["last_seen_at"],
        },
        "requests": items,
    }
    data = json.dumps(payload, ensure_ascii=True).encode("utf-8")
    headers = {"Content-Disposition": f'attachment; filename="requests-{token}.json"'}
    return Response(content=data, media_type="application/json", headers=headers)


@app.get("/admin/webhook-response/{token}")
def get_webhook_response_config(request: Request, token: str) -> JSONResponse:
    require_admin(request)
    config = get_response_config(token)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    try:
        body = json.loads(config["body_json"])
    except (TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=500, detail="Invalid stored config")
    return JSONResponse(
        content={
            "token": token,
            "status_code": config["status_code"],
            "body": body,
            "content_type": config["content_type"],
            "updated_at": config["updated_at"],
        }
    )


@app.put("/admin/webhook-response/{token}")
async def set_webhook_response_config(request: Request, token: str) -> JSONResponse:
    require_admin(request)
    payload = await request.json()
    status_code = payload.get("status_code")
    body = payload.get("body")
    if not isinstance(status_code, int) or not validate_status_code(status_code):
        raise HTTPException(status_code=400, detail="Invalid status_code")
    if body is None:
        raise HTTPException(status_code=400, detail="Missing body")

    try:
        body_json = json.dumps(body)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Body must be JSON-serializable")

    updated_at = utc_now()
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO webhook_response_config
                (token, status_code, body_json, content_type, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (token, status_code, body_json, "application/json", updated_at),
        )
        conn.commit()
    finally:
        conn.close()

    return JSONResponse(content={"ok": True, "updated_at": updated_at})


@app.delete("/admin/webhook-response/{token}")
def delete_webhook_response_config(request: Request, token: str) -> JSONResponse:
    require_admin(request)
    conn = get_connection()
    try:
        conn.execute("DELETE FROM webhook_response_config WHERE token = ?", (token,))
        conn.commit()
    finally:
        conn.close()
    return JSONResponse(content={"ok": True})
