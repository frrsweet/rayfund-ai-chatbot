import os
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db
from .engine import Engine

BASE = Path(__file__).parent.parent
STATIC = BASE / "static"
ADMIN_KEY = os.getenv("ADMIN_KEY", "dev")
ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
RATE_LIMIT = int(os.getenv("RATE_LIMIT", "20"))
RATE_WINDOW = 60

app = FastAPI(title="rayfund-bot")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])
db.init()
engine = Engine()
hits = defaultdict(deque)


def client_ip(request: Request):
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate(ip):
    now = time.time()
    window = hits[ip]
    while window and now - window[0] > RATE_WINDOW:
        window.popleft()
    if len(window) >= RATE_LIMIT:
        raise HTTPException(429, "Слишком много запросов, подождите минуту")
    window.append(now)


class ChatIn(BaseModel):
    session_id: str = Field(min_length=8, max_length=64)
    text: str | None = Field(default=None, max_length=1000)
    intent_id: str | None = Field(default=None, max_length=100)


@app.get("/api/health")
def health():
    return {"ok": True, "intents": len(engine.intents), "phrases": len(engine.phrases)}


@app.post("/api/chat")
def chat(body: ChatIn, request: Request):
    check_rate(client_ip(request))
    if body.intent_id:
        if body.intent_id not in engine.intents:
            raise HTTPException(404, "Неизвестная тема")
        db.save(body.session_id, "user", engine.label(body.intent_id), intent=body.intent_id, status="picked")
        result = {
            "status": "answer",
            "intent": body.intent_id,
            "score": 1.0,
            "suggestions": [],
            **engine.render(body.intent_id),
        }
    elif body.text and body.text.strip():
        text = body.text.strip()
        db.save(body.session_id, "user", text)
        result = engine.respond(text)
    else:
        raise HTTPException(422, "Пустое сообщение")
    db.save(body.session_id, "bot", result["reply"], intent=result["intent"], score=result["score"], status=result["status"])
    return result


@app.get("/api/admin/messages")
def admin_messages(limit: int = 200, x_admin_key: str | None = Header(default=None)):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(401, "Неверный ключ")
    return db.recent(min(limit, 1000))


@app.get("/admin")
def admin_page():
    return FileResponse(STATIC / "admin.html")


@app.get("/")
def demo_page():
    return FileResponse(STATIC / "demo.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")
