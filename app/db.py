import os
import sqlite3
import time

DB_PATH = os.getenv("DB_PATH", "chat.db")


def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    with conn() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                text TEXT NOT NULL,
                intent TEXT,
                score REAL,
                status TEXT,
                ts REAL NOT NULL
            )"""
        )
        c.execute("CREATE INDEX IF NOT EXISTS idx_session ON messages(session_id, id)")


def save(session_id, role, text, intent=None, score=None, status=None):
    with conn() as c:
        c.execute(
            "INSERT INTO messages (session_id, role, text, intent, score, status, ts) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, role, text, intent, score, status, time.time()),
        )


def recent(limit=200):
    with conn() as c:
        rows = c.execute("SELECT * FROM messages ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]
