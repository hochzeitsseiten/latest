# Wedding Photo App

A simple wedding photo sharing app with three sections: upload, gallery, and photo challenge game.

## Project structure

```
├── index.html          # Single page app (GitHub Pages)
├── style.css           # Styles (child-blue theme)
├── app.js              # Frontend logic
├── assets/             # Static assets placeholder
├── .nojekyll           # Disable Jekyll on GitHub Pages
└── backend/
    ├── main.py         # FastAPI server
    ├── tasks.json      # Photo challenge tasks (editable)
    ├── requirements.txt
    ├── Dockerfile
    └── docker-compose.yml
```

## Frontend (GitHub Pages)

The frontend is a static single-page app served by GitHub Pages. It communicates with the backend API.

**Configure the API URL** in `app.js` – set `API_BASE` (via `window.WEDDING_API_BASE` or the hardcoded default) to your backend domain (the Cloudflare tunnel URL).

The couple photo and app config are fetched from the backend (`/assets/couple.jpg` and `/config`).

## Backend (Docker on VPS)

### Quick start

```bash
cd backend

# Set your environment variables
export WEDDING_API_KEY="your-secret-key"
export COUPLE_NAME="Namen"
export CLOUDFLARE_TOKEN="your-cloudflare-tunnel-token"

# Build and run (includes Cloudflare tunnel)
docker compose up -d --build
```

The API runs on port `8000`. The Cloudflare tunnel is included in `docker-compose.yml` and exposes the API automatically.

**Add your couple photo** by placing it at `backend/data/assets/couple.jpg` (i.e. the `./data/assets/` folder mounted into the container).

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `WEDDING_API_KEY` | `changeme` | API key for authentication |
| `COUPLE_NAME` | `Brautpaar` | Couple's name shown in the app |
| `CLOUDFLARE_TOKEN` | *(required)* | Cloudflare tunnel token |
| `UPLOAD_DIR` | `/data/uploads` | Upload storage path |
| `THUMB_DIR` | `/data/thumbnails` | Thumbnail storage path |
| `TASKS_FILE` | `/app/tasks.json` | Photo challenge tasks file |
| `GAME_LOG` | `/data/game_log.json` | Game submissions log file |
| `COUPLE_IMAGE` | `/data/assets/couple.jpg` | Couple photo path inside container |

### API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/config` | App config (couple name, image availability) |
| `GET` | `/assets/couple.jpg` | Serve couple photo |
| `POST` | `/upload` | Upload photo/video |
| `GET` | `/gallery` | List gallery thumbnails (images only) |
| `GET` | `/thumbnails/{file}` | Serve thumbnail |
| `GET` | `/uploads/{file}` | Serve original file |
| `GET` | `/task` | Get assigned photo challenge task |
| `POST` | `/task/new` | Request a new/next challenge task |
| `POST` | `/game/submit` | Submit game photo with name |
| `GET` | `/health` | Health check |

All endpoints (except `/health`) require the `X-API-Key` header. Task and game endpoints also use `X-User-Id` to track per-user state.

## QR Code

Generate a QR code pointing to: `https://hochzeitsseiten.github.io/latest/?key=your-secret-key`

The API key is stored in browser cookies on first visit so subsequent visits work without the QR code.
