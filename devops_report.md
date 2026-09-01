# Integration Report — Birthday Wishes Card App

## 1. Overall Consistency

The stack is largely coherent: React/Vite frontend, Express backend, better-sqlite3 for metadata, sharp for image processing, local disk storage under `/uploads`, single-server deployment model. Naming conventions, color/design tokens, and file structure all line up with the stated architecture. A few concerns stood out:

- **Duplicate/competing DB schema definitions.** The `cards` table is defined in **three places** with different shapes:
  - `backend/db.js` — `cards(id, name, message, photo_paths TEXT JSON, created_at)`
  - `backend/server.js` — inline `CREATE TABLE cards(...)` (truncated, but starts with `id, reci...` i.e. `recipient_name`, diverging column name from `db.js`'s `name`)
  - `backend/routes/cards.js` — `cards(id, recipient_name, message, created_at)` **plus a separate normalized `card_images` table**, with no `photo_paths` column at all.

  This is a real schema conflict: `db.js` stores photos as a JSON blob column on `cards`, while `routes/cards.js` expects a fully separate `card_images` table. Since `better-sqlite3` runs `CREATE TABLE IF NOT EXISTS` from multiple files against the same `cards.db`, whichever module initializes first "wins" the column set, and the other module's queries (e.g. inserting into `photo_paths` vs. `card_images`) will fail at runtime. **These three schema owners need to be collapsed into a single source of truth** (recommend keeping `db.js` as the only schema owner and having `server.js`/`routes/cards.js` just `require('../db')`).

- **Field name mismatch risk:** `name` (db.js) vs. `recipient_name` (server.js / routes/cards.js) — confirm which is authoritative before any code queries `cards.name`.

## 2. Missing Wiring

- **`CardCreatedPage.jsx` is orphaned.** It exists under `frontend/src/pages/` and is fully built (with `ShareLinkBar`), but `main.jsx`'s router only defines `/`, `/card/:cardId`, and `*` (404). There is **no route for a "card created / success" page**. Either:
  - `CreateCardPage` is expected to navigate straight to `/card/:cardId` after submit (in which case `CardCreatedPage.jsx` is dead code), or
  - a route like `/card/:cardId/created` (or similar) needs to be added to `main.jsx` and `CreateCardPage`'s post-submit `navigate()` call needs to target it.

  This needs to be confirmed against `CreateCardPage.jsx`'s submit handler (truncated in the provided files) — please verify where `navigate()` points.

- **`backend/routes/cards.js` mounting not shown/confirmed.** `server.js` was truncated before any `app.use('/api/cards', ...)` line. Please confirm the route file is actually required and mounted, and that `frontend/src/api/client.js`'s `API_BASE = '/api'` paths (`POST /api/cards`, presumably `GET /api/cards/:id`) match the router's internal paths exactly (e.g. router defines `router.post('/')` mounted at `/api/cards`, not `/api`).

- **Static file serving for uploads not confirmed.** `imageProcessing.js` assumes Express serves `UPLOADS_ROOT` at `/uploads` via `express.static`. This line was not visible in the truncated `server.js` — confirm `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))` exists, otherwise photo URLs returned by the API will 404.

- **Frontend build output serving:** `server.js` references `FRONTEND_DIST_DIR` — confirm there's a corresponding `app.use(express.static(FRONTEND_DIST_DIR))` + SPA fallback (`app.get('*', ...)` sending `index.html`) so client-side routes like `/card/:cardId` don't 404 on a hard refresh/direct link in production.

- **Env var name mismatch:** `.env.example` defines `UPLOAD_DIR` and `MAX_FILE_SIZE`, but `server.js` reads `process.env.MAX_PHOTOS`, `process.env.MAX_FILE_SIZE_MB`, and hardcodes `UPLOADS_DIR` relative to `__dirname` rather than reading `UPLOAD_DIR` from env. `middleware/upload.js` and `routes/cards.js` also hardcode their own `MAX_FILE_SIZE` / `MAX_PHOTOS` constants (8MB/6 vs. frontend's 5MB/6 in `CreateCardPage.jsx`) instead of reading from a single config. Align these to one source (ideally env-driven) so client-side validation limits match server-enforced limits.

## 3. Setup & Run Steps

**Prerequisites:** Node.js ≥ 18 (per `package.json` `engines`), npm.

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd birthday-wishes-card

# 2. Install all dependencies (root postinstall also runs this automatically)
npm install
# equivalent to: npm run install:all
#   -> npm install --prefix backend
#   -> npm install --prefix frontend

# 3. Configure backend environment
cd backend
cp .env.example .env
# edit .env as needed:
#   PORT=3001
#   BASE_URL=http://localhost:3001
#   UPLOAD_DIR=uploads
#   MAX_FILE_SIZE=5242880
cd ..

# 4. Run in development (frontend + backend concurrently)
npm run dev
#   backend on http://localhost:3001 (Express API)
#   frontend on http://localhost:5173 (Vite dev server, proxies /api and /uploads to :3001)

# 5. Production build & run (single Node server)
npm run build          # builds frontend into frontend/dist
npm start               # starts backend, which should serve frontend/dist + /api + /uploads
# App available at http://localhost:3001
```

**Before first production run, verify:**
1. `backend/data/` and `backend/uploads/` (+ `uploads/full`, `uploads/thumbs`, `uploads/tmp`) directories are writable — they're auto-created on boot but confirm host filesystem persistence (ephemeral filesystems on Render/Railway free tiers will lose uploads + SQLite DB on redeploy; consider a persistent volume).
2. The `cards.db` schema conflict noted in §1 is resolved — otherwise expect runtime `SQLITE_ERROR: no such column` failures on card creation or retrieval.
3. `CORS_ORIGIN` is set appropriately if frontend and backend are ever split across origins (not needed for the single-server deployment model, but present in `.env` options).