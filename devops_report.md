# Integration Report — birthday-wishes-card

## 1. Overall Consistency

The React/Vite frontend and Express/SQLite backend follow a coherent shape (routes → controllers → SQLite, Vite proxy for `/api` and `/uploads`, single monorepo with root `dev`/`build`/`start` scripts). However, several pieces have **drifted from each other** and at least one is actively broken (matches the failed boot check).

| Area | Status | Notes |
|---|---|---|
| Frontend routing (`main.jsx`) ↔ pages | ✅ Consistent | `/`, `/admin`, `/card/:id`, `*` all map to files that exist. |
| `frontend/src/api/client.js` ↔ `backend/routes/cards.js` | ✅ Consistent | `POST /cards`, `GET /cards/:id` match router handlers. |
| Vite proxy config ↔ backend port | ✅ Consistent | Proxies `/api` and `/uploads` to `localhost:3001`, matching `PORT` default in `.env.example`. |
| **Database layer** | ⚠️ Inconsistent | `db.js` uses `node:sqlite`'s `DatabaseSync`, but project docs/architecture notes state **better-sqlite3**. Only one of these is likely actually installed — check `backend/package.json`. Also, `node:sqlite` is not available/stable on Node 18, which conflicts with `engines.node >= "18"` in the root `package.json`. |
| **DB import pattern** | 🔴 Bug | `backend/routes/cards.js` does `const { db } = require('../db')` (correct — destructures the sqlite instance), but `backend/utils/analytics.js` does `const db = require('../db')` (no destructure) — this binds `db` to the whole module object (`{ TABLE, COLUMNS, COLUMN_LIST, db }`), not the database handle. Any `db.prepare(...)` call in `analytics.js` will throw `db.prepare is not a function` at runtime. |
| **Admin session logic** | ⚠️ Duplicated/conflicting | Both `backend/middleware/adminAuth.js` and `backend/routes/admin.js` independently implement admin session cookies named `admin_session`, but with **different TTLs** (12h vs 24h) and separate in-memory session stores. It's unclear which is actually wired into `server.js` (only `adminRouter` is imported there) — `adminAuth.js` looks like dead/legacy code that should be deleted or reconciled. |
| **Admin auth model (frontend vs backend)** | ⚠️ Possible mismatch | `api/client.js` explicitly documents a **cookie-based** session flow ("never store password or Basic Auth token client-side... HttpOnly Secure cookie"). But `AdminDashboardPage.jsx` defines `const ADMIN_AUTH_KEY = 'adminAuthHeader'`, implying an **Authorization header stored in localStorage**. Confirm which auth strategy is actually implemented end-to-end — right now the naming suggests two different design intents were mixed. |

## 2. Missing / Broken Wiring

- 🔴 **`backend/routes/admin.js` imports `require('../analytics')`**, but the actual file lives at `backend/utils/analytics.js`. There is no `backend/analytics.js`. This will throw `MODULE_NOT_FOUND` the moment `server.js` loads the admin router — **this is a near-certain contributor to the boot failure** in the execution gate. Fix: change to `require('../utils/analytics')`.
- 🔴 **Server boot crash (`MODULE_NOT_FOUND` at `server.js:1:1`)**: since `require.requireStack` shows only `server.js`, the unresolved module is one required *directly* by it — top candidates given the visible code are `dotenv`, `cookie-parser`, or `express-session`. These must be present in `backend/package.json` `dependencies` **and** actually installed. Action: inspect `backend/package.json`, confirm all of `dotenv`, `express`, `cookie-parser`, `express-session`, `nanoid`, `multer`, `sharp`, `better-sqlite3` (if that's the real choice) are listed, then run a clean `npm install --prefix backend`.
- ⚠️ `server.js` snippet cuts off before we can confirm it serves the built frontend (`frontend/dist`) statically in production. The root `npm start` script only runs `backend`, so if `server.js` doesn't have a static-serving + SPA-fallback block, `npm run build && npm start` will boot an API-only server with no way to serve the built UI. Please verify/add `express.static(path.join(__dirname, '../frontend/dist'))` + a catch-all route.
- ⚠️ `backend/db.js` resolves `DB_PATH` to `backend/data/cards.db`, but `.env.example` also defines `DATABASE_PATH=./data/cards.db`, which doesn't appear to be read anywhere in the `db.js` excerpt shown (it hardcodes the path via `__dirname` instead of `process.env.DATABASE_PATH`). Minor drift between config surface and actual code.
- ⚠️ Confirm `backend/utils/watermark.js` (imported by `routes/cards.js`) and `backend/analytics.js`/`utils/analytics.js` split actually resolves consistently — `routes/cards.js` imports `require('../utils/analytics')` (correct path) while `routes/admin.js` imports `require('../analytics')` (wrong path, see above) — same module, two different (only one correct) import paths in the codebase.

## 3. Setup & Run Steps

> ⚠️ **Fix the two 🔴 issues above (`admin.js` import path, and confirm/install the missing backend dependency) before attempting to boot — the server currently exits with code 1.**

```bash
# 1. From the project root
cd outputs/birthday-wishes-card

# 2. Install all dependencies (root postinstall also installs backend + frontend)
npm install

# 3. Configure backend environment
cp backend/.env.example backend/.env
# Edit backend/.env and set real values for:
#   SESSION_SECRET, COOKIE_SECRET (generate via: openssl rand -base64 32)
#   ADMIN_PASSWORD
# (dev mode will fall back to insecure defaults with a warning if left unset,
#  but the app refuses to boot in production without them)

# 4. (Optional) Frontend env override — only needed if API isn't proxied
# frontend/.env
#   VITE_API_BASE_URL=http://localhost:3001/api

# 5. Run in development (concurrently starts backend :3001 + frontend :5173)
npm run dev

# 6. Verify
#   Frontend: http://localhost:5173
#   Backend health/API: http://localhost:3001/api/cards
#   Admin panel: http://localhost:5173/admin

# --- Production build ---
npm run build          # builds frontend/dist
npm start              # starts backend only — confirm server.js serves frontend/dist (see note above)
```

**Before re-running the execution gate:**
1. Fix `backend/routes/admin.js` → `require('../utils/analytics')`.
2. Fix `backend/utils/analytics.js` → `const { db } = require('../db')`.
3. Confirm `backend/package.json` lists and has installed `dotenv`, `cookie-parser`, `express-session`, and whichever SQLite driver is actually used.
4. Reconcile `node:sqlite` vs `better-sqlite3` vs the `engines.node >= 18` claim — pick one and make it consistent everywhere (code, docs, `package.json`).
5. Decide on one admin-auth mechanism (cookie session vs. header token) and remove the unused implementation (`middleware/adminAuth.js` vs `routes/admin.js` vs frontend's `adminAuthHeader`).