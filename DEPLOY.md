# Deployment Guide (Tourne-Sabre)

Tourne-Sabre runs as a single Node.js service (Express API + Socket.IO + static `frontend/build/`) backed by MongoDB.

## Architecture

- **Single-port server (`backend/src/app.js`)**:
  - Listens on `process.env.PORT || 8080` for HTTP (`/map`, `/lab`, `/healthz`), WebSocket (`Socket.IO`), and static assets from `frontend/build/` (when built).
  - `/healthz` returns `{ ok: true, dbReady: boolean }`.
  - When `NODE_ENV=production`, `PUT /lab/notes/:type` returns `403` so public visitors cannot overwrite `ENEMY_NOTES.json`.
- **Automatic client origin (`frontend/src/apiConfig.js`)**:
  - Uses `REACT_APP_API_URL` if set.
  - On local dev/preview ports (`:3000`, `:3001`), connects to `:8080` on the same hostname.
  - On unified single-port deploys (Render, Fly.io, or `http://localhost:8080`), uses `window.location.origin` for both REST and Socket.IO.
- **Live State & Transport (`backend/src/db/`, `backend/src/app.js`)**:
  - Live player and item state runs in server memory (`playerdb`/`itemdb`) with zero per-tick database round-trips; startup seeds 1,000 arena items immediately.
  - Real-time sync (arena snapshots, player movement, attacks, spells, augments, and incremental item respawns) streams over Socket.IO; REST `/map/*` endpoints remain backed by the same in-memory store as a fallback and for `supervisor.js`.
  - No external database is required for live gameplay (`MONGODB_URI` is optional/unused for live match state).

## Local Verification

1. **Start disposable local MongoDB (Docker)**:
   ```sh
   docker run -d --name tourne-sabre-mongo -p 127.0.0.1:27017:27017 mongo:6
   ```
2. **Build frontend (Node 18+ requires legacy OpenSSL provider for `react-scripts 4`)**:
   ```sh
   NODE_OPTIONS=--openssl-legacy-provider npm run build --prefix frontend
   ```
3. **Verify Docker production image**:
   ```sh
   docker build -t tourne-sabre .
   ```
4. **Check live endpoints**:
   - `GET /healthz` → `{"ok":true,"dbReady":true}`
   - `GET /` → `200 OK` (serves `frontend/build/index.html`)
   - `GET /?lab` → Enemy Lab (read-only notes in production)

## Production Deploy (MongoDB Atlas + Render)

1. **MongoDB Atlas (Free M0)**:
   - Create an `M0` cluster (recommended region: Tokyo `ap-northeast-1` or Singapore).
   - Create a database user and allow network access (`0.0.0.0/0` for Render).
   - Build the connection string:
     ```text
     mongodb+srv://<user>:<password>@<cluster>.mongodb.net/tourne_sabre?retryWrites=true&w=majority
     ```
   - Keep personal connection strings only in gitignored `.env.local` (never commit credentials).
2. **Render Blueprint (`render.yaml` + `Dockerfile`)**:
   - Push changes to `main` on GitHub.
   - In Render Dashboard: **New + → Blueprint** → select the repository and `main` branch (`render.yaml` is detected automatically).
   - Set `MONGODB_URI` to the Atlas connection string and click **Apply**.
   - Render builds the multi-stage `Dockerfile`, runs health checks against `/healthz`, and exposes the game over HTTPS.
   - Future pushes to `main` automatically trigger redeployments.
