# EchoEndpoint

Webhook.site-style request inspector built with FastAPI, SQLite, and SSE.

## Run locally

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000` and click **Create Your Webhook URL**.

## Use it

- Webhook URL format: `http://127.0.0.1:8000/wh/<token>`
- Dashboard URL format: `http://127.0.0.1:8000/e/<token>`

Send a request:

```bash
curl -X POST "http://127.0.0.1:8000/wh/<token>?foo=bar" \
  -H "Content-Type: application/json" \
  -d "{\"hello\":\"world\"}"
```

The dashboard updates in real time via SSE.
