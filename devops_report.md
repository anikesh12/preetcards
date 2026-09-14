# Integration Report — birthday-wishes-card

## 1. Consistency Check

**Overall the frontend/backend contract is mostly coherent** (routes, occasions, collage layouts, and slug-based card IDs line up across `CreateCardPage.jsx`, `api/client.js`, `routes/cards.js`, and `db.js`). However, several pieces contradict each other or the stated architecture:

| Area | Issue |
|---|---|
| **Database driver** | Architecture notes say SQLite via **better-sqlite3**, but `backend/db.js` actually uses `node:sqlite` (`DatabaseSync`) — Node's built-in experimental SQLite module. This requires **Node ≥ 22** with SQLite support, contradicts the documented dependency, and is not reflected in `package.json`'s `engines` field (`>=18`). |
| **`analytics.js` DB import** | `cards.js` correctly destructures: `const { db } = require('../db')`. But `utils/analytics.js` does `const db = require('../db');` (no destructuring) — it will get the whole exports object (`{ db, TABLE, COLUMNS, ... }`), not a usable `DatabaseSync` handle. Any `db.prepare(...)` call in analytics.js will throw at runtime. |
| **`routes/admin.js` require path** | `admin.js` does `const analytics = require('../analytics');`, resolving to `backend/analytics.js`. The actual file lives at `backend/utils/analytics.js`. **This require will fail (`MODULE_NOT_FOUND`)** as soon as any request hits an admin route that uses it, or immediately on boot if it's required at module load time. |
| **Duplicate admin auth logic** | Both `middleware/adminAuth.js` (cookie + in-memory lockout) and `routes/admin.js` (its own session store + `SESSION_COOKIE_NAME`) implement admin session handling independently. It's unclear which is actually wired into `server.js` — likely only one is mounted, leaving the other dead code / a maintenance trap. |
| **Admin auth model mismatch (frontend)** | `frontend/src/api/client.js` explicitly documents a **cookie-based, HttpOnly session** flow (no token stored client-side). But `frontend/src/api/adminClient.js` implements a **Bearer-token** flow (`localStorage` token, `Authorization` header). `AdminLoginPage.jsx` calls `/api/admin/login` directly via `fetch` and never captures/stores a token — so if the backend ever returns a token (matching `adminClient.js`'s expectation), it's silently dropped. Two incompatible admin auth patterns exist in the same app. |
| **`.env.example` incomplete** | `server.js` hard-requires both `SESSION_SECRET` **and** `COOKIE_SECRET` in production (exits with code 1 if either is missing). `backend/.env.example` only documents `SESSION_SECRET` — `COOKIE_SECRET` is missing entirely, so anyone following the example file will still fail the production boot check. |

## 2. Missing / Broken Wiring

- ❌ **`backend/routes/admin.js` → `require('../analytics')`** — path is wrong; real file is `backend/utils/analytics.js`. This is likely the actual root cause (or a second, latent instance) of the class of `MODULE_NOT_FOUND` failure seen in the boot log.
- ❌ **Boot failure reported**: `server.js:1:1` (`require('dotenv')`) throws `MODULE_NOT_FOUND`. This means the `backend/node_modules` directory does not have `dotenv` installed — either it's missing from `backend/package.json` dependencies, or `npm install` was never run inside `backend/`. **`backend/package.json` was not included in the provided files**, so it can't be confirmed it lists `dotenv`, `express`, `cookie-parser`, `express-session`, `multer`, `sharp`, `nanoid`, etc. as dependencies.
- ⚠️ `utils/analytics.js`'s broken `db` import (see table above) means any admin dashboard stat endpoint calling into analytics will 500 at runtime, not at boot — a silent landmine.
- ⚠️ No visibility into whether `server.js` serves the built `frontend/dist` in production (the file was truncated before this section) — cannot confirm the "single Node server serves frontend + API" claim in the architecture notes is actually implemented.
- ⚠️ `frontend/vite.config.js` proxies `/api` and `/uploads` to `http://localhost:3001` — consistent with `backend/routes/cards.js` serving uploads and `api/client.js`'s `/api` base — this part is fine, contingent on the backend actually starting.

## 3. Setup & Run Steps

**Prerequisites:** Node.js ≥ 22 (required for `node:sqlite` used in `db.js`, despite `engines` saying `>=18` — bump this or switch back to `better-sqlite3` per the architecture doc).

```bash
# 1. From project root
cd outputs/birthday-wishes-card

# 2. Create backend env file
cp backend/.env.example backend/.env

# 3. Edit backend/.env and set REQUIRED values not in the example:
#    SESSION_SECRET=<generate: openssl rand -base64 32>
#    COOKIE_SECRET=<generate: openssl rand -base64 32>   # NOT in .env.example — add manually
#    ADMIN_PASSWORD=<a real password>

# 4. Install all dependencies (root postinstall runs backend+frontend installs)
npm install

# 5. Fix known-broken require before starting (see §2):
#    backend/routes/admin.js: change
#      require('../analytics')  ->  require('../utils/analytics')
#    utils/analytics.js: change
#      const db = require('../db');  ->  const { db } = require('../db');

# 6. Run in dev mode (concurrently starts backend :3001 + frontend :5173)
npm run dev

# 7. Open the app
#    http://localhost:5173        (frontend, proxies /api and /uploads to :3001)
#    http://localhost:3001/api/…  (backend API directly, if needed)
```

**Production build:**
```bash
npm run build        # builds frontend/dist via Vite
NODE_ENV=production SESSION_SECRET=... COOKIE_SECRET=... ADMIN_PASSWORD=... npm start
# npm start -> backend/server.js — confirm it actually serves frontend/dist statically
# before relying on this as a single-server deploy (unverified from provided source).
```

**Before this ships:** resolve the `require('../analytics')` path bug, verify `backend/package.json` lists `dotenv` (and all other backend deps) as dependencies, reconcile the two competing admin-auth implementations, and pick one DB driver (`node:sqlite` vs `better-sqlite3`) consistently between code and docs.