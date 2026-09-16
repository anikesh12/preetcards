# Integration Report — Birthday Wishes Card (PreetCards)

## 1. Overall Consistency

The stack is architecturally coherent: React+Vite SPA talking to an Express API backed by SQLite (better-sqlite3), with sharp-based image processing and a shared `/api` prefix proxied in dev via `vite.config.js`. Naming conventions, folder layout (`/frontend`, `/backend`), and the config endpoint (`GET /api/config` ↔ `frontend/src/api/client.js#getConfig`) all line up correctly. However, the execution gate **failed outright** on both `npm run build` (frontend) and the backend boot check — this is not a cosmetic issue, the app cannot currently run.

## 2. Missing / Broken Wiring

| Issue | Detail |
|---|---|
| **Frontend build fails** | `frontend/src/pages/CardViewPage.jsx` imports `./CardViewPage.css`, but no such file exists in `pages/`. The actual stylesheet lives at `frontend/src/styles/cardView.css`. Fix: either move/rename the CSS into `pages/CardViewPage.css` or correct the import path to `../styles/cardView.css`. |
| **Backend crashes on boot (MODULE_NOT_FOUND)** | `backend/middleware/adminAuth.js` is listed as **missing**, yet `backend/routes/admin.js` (and/or `server.js`) almost certainly requires it to protect `/api/admin/dashboard`-style routes. Since `admin.js` also throws synchronously if `ADMIN_PASSWORD`/`SESSION_SECRET` aren't set, any require of this chain during startup will kill the process. This matches the observed `code: 'MODULE_NOT_FOUND'` crash in `server.js`. |
| **Admin router likely not mounted** | The visible portion of `server.js` only wires up `cardsRouter` and `configRouter`. There's no evidence of `app.use('/api/admin', adminRouter)`. `AdminLoginPage.jsx` calls `POST /api/admin/login` — if this route isn't mounted, login will always 404. |
| **`.env.example` is missing required admin secrets** | `backend/routes/admin.js` hard-fails (`throw new Error(...)`) if `ADMIN_PASSWORD` or `SESSION_SECRET` are unset, but neither variable appears in `backend/.env.example`. A fresh setup following the example `.env` will always crash the server the moment the admin module is loaded. |
| **`frontend/src/api/adminClient.js` missing** | Called out as absent. `AdminLoginPage.jsx`/`AdminDashboardPage.jsx` currently use raw `fetch` calls instead, so this may be dead scaffolding — but if any other file imports it, the frontend build will fail the same way `CardViewPage.css` did. Worth a repo-wide grep for `adminClient`. |
| **`db.js` export shape mismatch** | `backend/db.js` (as shown) instantiates `const db = new Database(...)` and exposes helper functions — the visible snippet doesn't confirm a final `module.exports`, but `backend/utils/analytics.js` does `const { db } = require('../db');` (destructured). If `db.js` exports the instance directly (`module.exports = db`) rather than `{ db, createCard, ... }`, `analytics.js`'s `db` will be `undefined`, breaking every `db.prepare(...)` call inside it at first use. |
| **Template ID mismatch** | Frontend (`CreateCardPage.jsx`) offers template ids `classic`, `confetti`, `balloons`, `customized-card`. Backend's `ALLOWED_TEMPLATES` in `routes/cards.js` allows `default`, `Customized-card` (capital C), `classic`, `confetti` — **`balloons` isn't allowlisted at all**, and casing on `customized-card` vs `Customized-card` won't match. Any card created with the "Balloon Fiesta" or "Customized Card" template will likely be rejected or silently coerced by validation. |

## 3. Setup / Run Steps

```bash
# 1. Clone and install (root postinstall triggers both frontend + backend installs)
cd birthday-wishes-card
npm install

# 2. Configure backend environment
cd backend
cp .env.example .env
# Edit .env and, at minimum, add (NOT in the current example file):
#   ADMIN_PASSWORD=<choose a strong password>
#   SESSION_SECRET=<random 32+ char string>
cd ..

# 3. Fix known-broken wiring before running (see section 2):
#    - resolve CardViewPage.css import path
#    - add backend/middleware/adminAuth.js (or remove the require if unused)
#    - confirm server.js mounts the admin router
#    - align db.js export with analytics.js's `{ db }` import

# 4. Development mode (concurrent backend :3001 + frontend :5173 with proxy)
npm run dev

# 5. Production build + single-server run
npm run build          # builds frontend into frontend/dist
npm start              # starts backend/server.js (must also serve frontend/dist statically)
```

**Verification checklist after fixes:**
1. `npm run build` completes without Rollup resolution errors.
2. `node backend/server.js` (or `npm start`) stays up — no `MODULE_NOT_FOUND`/thrown startup errors.
3. Hit `GET /api/config` — should return JSON, not proxy error.
4. Submit the create-card form for each of the 4 templates and confirm none are rejected by `ALLOWED_TEMPLATES`.
5. Attempt `/admin` login with the configured `ADMIN_PASSWORD` and confirm `/api/admin/login` responds (not 404).