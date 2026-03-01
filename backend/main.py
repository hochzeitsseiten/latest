"""
Wedding Photo App – Backend API
FastAPI server for photo uploads, gallery, and game mode.
"""

import os
import uuid
import json
import random
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image

# ---- Config ----
API_KEY = os.environ.get("WEDDING_API_KEY", "changeme")
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/data/uploads"))
THUMB_DIR = Path(os.environ.get("THUMB_DIR", "/data/thumbnails"))
TASKS_FILE = Path(os.environ.get("TASKS_FILE", "/app/tasks.json"))
GAME_LOG = Path(os.environ.get("GAME_LOG", "/data/game_log.json"))
THUMB_SIZE = (400, 400)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
THUMB_DIR.mkdir(parents=True, exist_ok=True)

# ---- Tasks ----
if TASKS_FILE.exists():
    TASKS = json.loads(TASKS_FILE.read_text())
else:
    TASKS = [
        "Mach ein Selfie mit dem Brautpaar!",
        "Fotografiere jemanden beim Tanzen.",
        "Finde die älteste Person auf der Feier und mach ein Foto.",
        "Mach ein Foto vom Kuchenbuffet.",
        "Fotografiere zwei Gäste beim Anstoßen.",
        "Fange den schönsten Blumenstrauß im Bild ein.",
        "Mach ein lustiges Gruppenfoto.",
        "Fotografiere die Schuhe der Braut.",
        "Finde jemanden mit Hut und mach ein Foto.",
        "Mach ein Foto vom Sonnenuntergang (oder dem Himmel).",
    ]

# Track which task is assigned to which user_id
user_tasks: dict[str, str] = {}

# Game log persistence
def _load_game_log() -> list[dict]:
    if GAME_LOG.exists():
        return json.loads(GAME_LOG.read_text())
    return []

def _save_game_log(log: list[dict]):
    GAME_LOG.write_text(json.dumps(log, ensure_ascii=False, indent=2))

# ---- App ----
app = FastAPI(title="Wedding Photo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Auth dependency ----
def verify_key(x_api_key: str = Header(default="")):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ---- Routes ----

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    x_api_key: str = Header(default=""),
    x_user_id: str = Header(default=""),
):
    verify_key(x_api_key)

    ext = Path(file.filename or "file").suffix.lower()
    file_id = uuid.uuid4().hex
    filename = file_id + ext
    filepath = UPLOAD_DIR / filename

    contents = await file.read()
    filepath.write_bytes(contents)

    # Generate thumbnail for images
    if ext in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        try:
            img = Image.open(filepath)
            img.thumbnail(THUMB_SIZE)
            thumb_path = THUMB_DIR / (file_id + ".jpg")
            img.convert("RGB").save(thumb_path, "JPEG", quality=75)
        except Exception:
            pass  # skip thumbnail on failure

    return {"ok": True, "id": file_id}


@app.get("/gallery")
async def gallery(
    x_api_key: str = Header(default=""),
):
    verify_key(x_api_key)

    images = []
    for thumb in sorted(THUMB_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        file_id = thumb.stem
        # Find the original
        originals = list(UPLOAD_DIR.glob(file_id + ".*"))
        original = originals[0] if originals else None
        images.append({
            "id": file_id,
            "thumbnail": "/thumbnails/" + thumb.name,
            "full": "/uploads/" + (original.name if original else thumb.name),
        })

    return {"images": images}


@app.get("/thumbnails/{filename}")
async def serve_thumbnail(filename: str, x_api_key: str = Header(default="")):
    verify_key(x_api_key)
    path = THUMB_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(path, media_type="image/jpeg")


@app.get("/uploads/{filename}")
async def serve_upload(filename: str, x_api_key: str = Header(default="")):
    verify_key(x_api_key)
    path = UPLOAD_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(path)


@app.get("/task")
async def get_task(
    x_api_key: str = Header(default=""),
    x_user_id: str = Header(default=""),
):
    verify_key(x_api_key)

    if not x_user_id:
        raise HTTPException(status_code=400, detail="Missing user id")

    if x_user_id not in user_tasks:
        user_tasks[x_user_id] = random.choice(TASKS)

    return {"task": user_tasks[x_user_id]}


@app.post("/game/submit")
async def game_submit(
    file: UploadFile = File(...),
    name: str = Form(...),
    task: str = Form(""),
    x_api_key: str = Header(default=""),
    x_user_id: str = Header(default=""),
):
    verify_key(x_api_key)

    ext = Path(file.filename or "file").suffix.lower()
    file_id = uuid.uuid4().hex
    filename = file_id + ext
    filepath = UPLOAD_DIR / filename

    contents = await file.read()
    filepath.write_bytes(contents)

    # Thumbnail
    if ext in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        try:
            img = Image.open(filepath)
            img.thumbnail(THUMB_SIZE)
            thumb_path = THUMB_DIR / (file_id + ".jpg")
            img.convert("RGB").save(thumb_path, "JPEG", quality=75)
        except Exception:
            pass

    # Log game entry
    log = _load_game_log()
    log.append({
        "user_id": x_user_id,
        "name": name,
        "task": task,
        "file_id": file_id,
        "filename": filename,
    })
    _save_game_log(log)

    return {"ok": True, "id": file_id}


@app.get("/health")
async def health():
    return {"status": "ok"}
