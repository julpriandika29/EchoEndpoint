import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS endpoints (
                id INTEGER PRIMARY KEY,
                token TEXT UNIQUE NOT NULL,
                created_at DATETIME NOT NULL,
                last_seen_at DATETIME NULL
            );
            CREATE INDEX IF NOT EXISTS idx_endpoints_token ON endpoints(token);

            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY,
                endpoint_id INTEGER NOT NULL,
                received_at DATETIME NOT NULL,
                method TEXT NOT NULL,
                path TEXT NOT NULL,
                query TEXT,
                headers_json TEXT NOT NULL,
                body_blob BLOB,
                body_text TEXT NULL,
                content_type TEXT NULL,
                remote_ip TEXT NOT NULL,
                user_agent TEXT NULL,
                truncated INTEGER NOT NULL DEFAULT 0,
                body_size INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(endpoint_id) REFERENCES endpoints(id)
            );
            CREATE INDEX IF NOT EXISTS idx_requests_endpoint_id ON requests(endpoint_id);
            CREATE INDEX IF NOT EXISTS idx_requests_received_at ON requests(received_at);
            """
        )
        conn.commit()
    finally:
        conn.close()
