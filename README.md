# Gabi & Flo – Wedding Photo App

A simple wedding photo sharing app with three sections: upload, gallery, and photo challenge game.

## Project structure

```
├── index.html          # Single page app (GitHub Pages)
├── style.css           # Styles (child-blue theme)
├── app.js              # Frontend logic
├── assets/
│   └── couple.jpg      # Replace with actual couple photo
├── .nojekyll           # Disable Jekyll on GitHub Pages
└── backend/
    ├── main.py         # FastAPI server
    ├── tasks.json      # Photo challenge tasks (editable)
    ├── requirements.txt
    ├── Dockerfile
    ├── docker-compose.yml
    └── .dockerignore
```

## Frontend (GitHub Pages)

The frontend is a static single-page app served by GitHub Pages. It communicates with the backend API.

**Configure the API URL** in `app.js` – set `API_BASE` to your backend domain (the Cloudflare tunnel URL).

**Add your couple photo** as `assets/couple.jpg`.

## Backend (Docker on VPS)

### Quick start

```bash
cd backend

# Set your secret API key
export WEDDING_API_KEY="your-secret-key"

# Build and run
docker compose up -d --build
```

The API runs on port `8000`. Point your Cloudflare tunnel to `http://localhost:8000`.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `WEDDING_API_KEY` | `changeme` | API key for authentication |
| `UPLOAD_DIR` | `/data/uploads` | Upload storage path |
| `THUMB_DIR` | `/data/thumbnails` | Thumbnail storage path |
| `TASKS_FILE` | `/app/tasks.json` | Photo challenge tasks file |

### API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload` | Upload photo/video |
| `GET` | `/gallery` | List gallery thumbnails (images only) |
| `GET` | `/thumbnails/{file}` | Serve thumbnail |
| `GET` | `/uploads/{file}` | Serve original file |
| `GET` | `/task` | Get assigned photo challenge task |
| `POST` | `/game/submit` | Submit game photo with name |
| `GET` | `/health` | Health check |

All endpoints (except `/health`) require `X-API-Key` header.

## QR Code

Generate a QR code pointing to: `https://gabiundflo.github.io/?key=your-secret-key`

The API key is stored in browser cookies on first visit so subsequent visits work without the QR code.
