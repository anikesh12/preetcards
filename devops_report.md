# Integration Report — Birthday Wishes Card

## 1. Consistency Overview

The project is a coherent monorepo (`/frontend` + `/backend`) and the high-level architecture (Vite React SPA + Express API + SQLite + local disk uploads via sharp) is followed consistently across the files reviewed. Design tokens, routing, and the single-server production deployment model all line up with the stated architecture. However, there are **several duplicated/competing implementations of the same responsibility** that suggest the backend was built in overlapping passes and never fully consolidated:

- **Card creation + upload handling is implemented three times**, each independently:
  - `backend/server.js` — inline `generateId()`, its own `multer` instance, own sharp resize logic.
  - `backend/routes/cards.js` — separate `multer` instance, uses `nanoid` for IDs, own resize logic.
  - `backend/middleware/upload.js` — a third `multer` config (temp-storage + magic-byte verification pattern).
  - `backend/utils/imageProcessing.js` and `backend/utils/slug.js` — a fourth/fifth set of "canonical" helpers for the same job.

  It's not verifiable from what's shown whether `server.js` actually mounts `routes/cards.js`, or whether it duplicates that logic inline instead. If both are active, you'll get double route registration or dead code; if only `server.js`'s inline version is wired up, then `routes/cards.js`, `middleware/upload.js`, `utils/slug.js`, and `utils/imageProcessing.js` may be **unused dead files** that look load-bearing but aren't. This needs to be resolved to one code path before shipping.

- **ID generation is inconsistent**: `server.js` (custom alphabet `generateId`), `routes/cards.js` (`nanoid`), and `utils/slug.js` (its own crypto-based `generateSlug` with a different, ambiguity-free alphabet) all generate the card's public ID differently. Only one of these should be the source of truth for the `cards.id` primary key / URL slug.

- **`nanoid` version risk**: `routes/cards.js` uses `const { nanoid } = require('nanoid')`. `nanoid` v4+ is ESM-only and **will throw on `require()`** under CommonJS. Confirm `backend/package.json` pins `nanoid@^3` if this file is actually in the active code path — otherwise card creation will crash at import time.

- **Upload path mismatch**: `utils/imageProcessing.js` resolves `UPLOADS_DIR` as `path.join(__dirname, '..', '..', 'uploads')` — two levels up from `backend/utils`, i.e. the **project root's** `uploads/` folder. `server.js` and `routes/cards.js` both use `path.join(__dirname, 'uploads')`, i.e. **`backend/uploads`**. If `imageProcessing.js` is actually used for saving files, images would be written outside the directory that `server.js` serves statically (`backend/uploads`) and would 404 on `/uploads/...`.

- **Schema has both `id` and `slug` columns** (`backend/db.js`). Every consumer shown only ever generates a single card identifier and it's unclear whether `slug` is populated at insert time or left `NULL`. If any route reads by `slug` while inserts only populate `id` (or vice versa), lookups will fail silently (empty result, likely surfaced as a 404 on the card view page).

- **Frontend API access pattern is duplicated**: `frontend/src/api/client.js` is a well-built abstraction (with `ApiError`, field-level validation errors, etc.) intended for all API calls, but `CardViewPage.jsx` defines its own `API_BASE = '/api/cards'` and appears to fetch directly rather than going through `client.js`. Functionally this can still work, but it bypasses the shared error-handling/field-error logic and is a maintenance smell.

- **Env config appears unused**: `.env.example` defines `UPLOAD_DIR` and `MAX_FILE_SIZE=5242880` (5MB), but every backend file shown hardcodes `'uploads'` and `8 * 1024 * 1024` (8MB) instead of reading `process.env`. The example env file is misleading — changing it currently has no effect.

## 2. Missing / Unverified Wiring

- **Cannot confirm `GET /api/cards/:id` exists.** Only the `POST /` handler in `routes/cards.js` was visible. `CardViewPage.jsx` and `CardCreatedPage.jsx` (via `ShareLinkBar`) both depend on being able to fetch a single card by ID — this route must exist and must return `photo_paths` in a shape the frontend gallery components expect (`PhotoGallery` accepts either `{url, thumbnailUrl}` objects or plain string URLs — confirm the API response matches one of these).
- **Cannot confirm `router` from `routes/cards.js` is actually `app.use()`'d in `server.js`** — the visible portion of `server.js` never shows an `app.use('/api/cards', ...)` line; it only shows inline route-adjacent helpers. Verify this explicitly, since if it's missing, the frontend's `POST /api/cards` call has nothing to hit.
- **Static file serving for `/uploads`** — verify `server.js` has `app.use('/uploads', express.static(UPLOADS_DIR))` (implied by the vite proxy config, not confirmed in the shown snippet).
- **SPA fallback route** — verify `server.js` serves `FRONTEND_DIST/index.html` for non-API GET requests in production, otherwise refreshing `/card/:id` directly on the deployed server will 404 instead of letting React Router handle it.
- **`backend/package.json` and `frontend/package.json`** were not included in this file set — dependency versions (especially `nanoid`, `sharp` prebuilt binaries, `better-sqlite3` native build) can't be verified and are common sources of "works on my machine" failures.

## 3. Setup & Run Steps

```bash
# 1. Clone and install everything (root postinstall triggers backend + frontend installs)
git clone <repo-url>
cd birthday-wishes-card
npm install
# (or explicitly: npm run install:all)

# 2. Configure the backend
cp backend/.env.example backend/.env
# edit backend/.env if needed (PORT, BASE_URL, UPLOAD_DIR, MAX_FILE_SIZE)
# NOTE: confirm these vars are actually read by server.js before relying on them

# 3. Development (runs backend :3001 + frontend :5173 concurrently, with Vite proxying /api and /uploads to the backend)
npm run dev
# App: http://localhost:5173

# 4. Production build + run (single Node server serves built frontend + API)
npm run build       # builds frontend -> frontend/dist
npm start           # starts backend/server.js, which should serve frontend/dist + /api + /uploads
# App: http://localhost:3001 (or PORT from .env)
```

**Before first run**, verify:
1. `backend/data/` and `backend/uploads/` are writable (both are auto-created on boot, per `db.js` / `server.js`).
2. The duplicate route/upload/ID-generation logic (Section 1) is reconciled to a single implementation — as-is, there's real risk of either a crash (`nanoid` require) or silent path mismatches (`imageProcessing.js` uploads dir) depending on which files are actually wired into `server.js`.