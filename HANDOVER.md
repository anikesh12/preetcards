# Handover Document: Birthday Wishes Card

## Project Summary
Birthday Wishes Card is a minimal, single-purpose web app for creating one personalized birthday card and sharing it via a link. A user fills in a recipient name, a birthday message, and uploads up to a handful of photos; on submission the app generates a shareable card page displaying that content in a celebratory, mobile-first layout. The brief explicitly excluded user accounts, multi-card storage/history, and payment features — the scope is "create one card, view it, share the link."

**Status at handover: NOT SHIPPED.** All 20 planned files were built and individually passed QA and Security review, but the final UAT pass (2026-09-01T16:03:17Z) **failed** and was escalated to the CEO due to launch-blocking defects found by DevOps integration testing (see QA Record below). The core "fill form → submit → get shareable card" flow is not verified to work end-to-end.

## Architecture Decisions
- **Stack:** React + Vite (frontend SPA), Node.js + Express (backend API), SQLite via `better-sqlite3` (card metadata), local disk storage for uploaded images processed with `sharp` (resize/compress/thumbnail).
- **Deployment model:** Single Node server serves both the built frontend static assets and the API, so it can be deployed to any generic Node host (e.g. Render, Railway) or to Vercel with minor adaptation — no separate frontend/backend hosting required.
- **Repo layout:** Monorepo with `/frontend` (React SPA — form page + card view page, client-side routing via `react-router`) and `/backend` (Express API, SQLite data layer, `/uploads` static folder for processed images).
- **Card identity:** Short random slugs (`backend/utils/slug.js`) double as the DB primary key and the shareable URL path segment (e.g. `/card/:cardId`), avoiding sequential/guessable IDs.
- **Image handling:** Resize/compress/thumbnail happens synchronously on upload via `sharp` before the file is written to disk — a deliberate dependency-light choice to avoid standing up an external cloud storage/CDN service for an MVP.
- **⚠️ Known architecture defect (unresolved at handover):** The `cards` table is defined three inconsistent ways across `backend/db.js`, `backend/server.js`, and `backend/routes/cards.js` — mismatched column names (`name` vs `recipient_name`) and conflicting photo storage models (a `photo_paths` JSON column vs. a separate normalized `card_images` table). Because `better-sqlite3` creates whichever schema initializes first, other modules' queries do not reliably match the resulting schema. This must be resolved to a single schema source of truth before the app can be trusted to persist or retrieve cards correctly.

## Design Choices
- **Palette:** Warm, celebratory — coral pink `#FF6F91` and golden yellow `#FFC75F` accents, deep plum `#2E1F3B` text, soft cream `#FFFBF5` background.
- **Typography:** System sans-serif (Poppins/system-ui fallback) with a rounded, friendly weight for headings; plain system sans for body copy; a clear size hierarchy (large card title → medium message → small metadata).
- **Tone:** Playful, warm, celebratory, minimal and uncluttered, mobile-first.
- **Screen 1 — Create Card (Form Page):** Single-column, centered, max-width ~480px form on cream background. Fields: Recipient Name, Birthday Message (textarea with 0/500 char counter), Photo Upload (drag-and-drop/tap, thumbnail previews with per-photo remove, max 6 photos, client-side file-size/type validation). Full-width coral "Create Card" CTA with loading/disabled state during submit; auto-navigates to the generated card URL on success.
- **Screen 2 — Card View (Shareable Page):** Full-page celebratory layout with subtle confetti/balloon SVG decoration. "Happy Birthday, {Name}!" heading in golden yellow with plum outline. Message shown in a soft-shadow rounded panel preserving line breaks. Responsive photo grid (2 cols mobile, 3–4 desktop) with tap-to-enlarge lightbox and swipe on mobile. Sticky "Share" button (copies link, shows "Link copied!" toast, uses Web Share API where supported). Skeleton loading states and a friendly "Card not found" error state.
- **Screen 3 — Not Found / Error Page:** Centered, cream background, plum text, deflated-balloon icon, "Card Not Found"/404 heading, single "Create a New Card" CTA.
- Three approved HTML mockups exist under `outputs/birthday-wishes-card/mockups/` (`create_card_form_page.html`, `card_view_shareable_page.html`, `not_found_error_page.html`) and were signed off before development began.

## What Was Built
Delivered across 7 planned task groups (20 files total):

- **Project setup & architecture (T1):** `backend/server.js`, `backend/db.js`, `backend/.env.example`, `frontend/vite.config.js`, `frontend/src/main.jsx`, root `package.json`.
- **Card creation form UI (T2):** `frontend/src/pages/CreateCardPage.jsx`, `frontend/src/components/PhotoUploadInput.jsx`, `frontend/src/api/client.js`.
- **Card creation API & shareable link generation (T3):** `backend/routes/cards.js`, `backend/utils/slug.js`, `backend/utils/sanitize.js`.
- **Image upload & optimization (T4):** `backend/utils/imageProcessing.js`, `backend/middleware/upload.js`.
- **Shareable card view page (T5):** `frontend/src/pages/CardViewPage.jsx`, `frontend/src/components/PhotoGallery.jsx`.
- **Responsive design & cross-device polish (T6):** `frontend/src/styles/global.css`, `frontend/src/styles/cardView.css`.
- **Share link functionality & final QA (T7):** `frontend/src/components/ShareLinkBar.jsx`, `frontend/src/pages/CardCreatedPage.jsx`.

Every file above passed an individual execution check, a QA spec review, and a security review. However, `CardCreatedPage.jsx` was built but **never wired into `main.jsx`'s router**, which only defines routes for `/`, `/card/:cardId`, and a 404 catch-all — so the post-submission confirmation experience it was designed for has no route to reach it.

## QA Record
| Task | File | Attempts | Outcome | Notes |
|---|---|---|---|---|
| T1 | backend/server.js | 1 | PASS | — |
| T1.1 | backend/db.js | 1 | PASS | — |
| T1.2 | backend/.env.example | 1 | PASS | — |
| T1.3 | frontend/vite.config.js | 1 | PASS | — |
| T1.4 | frontend/src/main.jsx | 1 | PASS | — |
| T1.5 | package.json | 1 | PASS | — |
| T2 | frontend/src/pages/CreateCardPage.jsx | 1 | PASS | — |
| T2.1 | frontend/src/components/PhotoUploadInput.jsx | 1 | PASS | — |
| T2.2 | frontend/src/api/client.js | 1 | PASS | — |
| T3 | backend/routes/cards.js | 1 | PASS | — |
| T3.1 | backend/utils/slug.js | 1 | PASS | — |
| T3.2 | backend/utils/sanitize.js | 1 | PASS | — |
| T4 | backend/utils/imageProcessing.js | 1 | PASS | — |
| T4.1 | backend/middleware/upload.js | 2 | PASS (after fix) | Security flagged attempt 1: `fileFilter` trusted client-supplied `mimetype` and derived saved-file extension from unsanitized `originalname`, allowing spoofed uploads (e.g. `.php`/`.svg` disguised as images) and possible stored XSS. Fixed in attempt 2. |
| T5 | frontend/src/pages/CardViewPage.jsx | 1 | PASS | — |
| T5.1 | frontend/src/components/PhotoGallery.jsx | 1 | PASS | — |
| T6 | frontend/src/styles/global.css | 1 | PASS | — |
| T6.1 | frontend/src/styles/cardView.css | 1 | PASS | — |
| T7 | frontend/src/components/ShareLinkBar.jsx | 1 | PASS | — |
| T7.1 | frontend/src/pages/CardCreatedPage.jsx | 1 | PASS | — |

**DevOps final gate:** Re-ran every file's execution check as a build gate — all files passed (2026-09-01T16:02:25Z). Full integration report at `outputs/birthday-wishes-card/devops_report.md`.

**UAT — FAILED, escalated to CEO (2026-09-01T16:03:17Z):**
1. **Critical — backend schema conflict.** `db.js`, `server.js`, and `routes/cards.js` each define the `cards` table differently (`name` vs. `recipient_name`; JSON `photo_paths` column vs. a separate `card_images` table). `better-sqlite3` will only apply whichever schema initializes first, so queries from the other modules won't match. This will very likely cause `POST /api/cards` to throw at insert time, or `GET /api/cards/:id` to return incomplete/incorrect data — breaking the core "fill form → submit → get shareable card" scenario.
2. **Critical — missing route.** `CardCreatedPage.jsx` (confirmation page with `ShareLinkBar`) exists but is not registered in `main.jsx`'s router, so there is no way to land on it after form submission as designed.

**Verdict:** Both issues are launch-blocking. The project is **not cleared to ship** until the schema is unified to one source of truth and the confirmation route is wired into the submit flow and router.

## Revision History
- **backend/middleware/upload.js** — Attempt 1 flagged by Security for trusting client-supplied MIME type and unsanitized `originalname` for file extension (spoofing/stored-XSS risk). Attempt 2 rewrote the filter/naming logic and cleared Security review.
- **All other files** — built and cleared on first attempt; no revisions required at the individual-file QA/Security stage.
- **Outstanding (not yet actioned as of this document):** No revision has been made yet for the UAT-identified schema conflict (T1/T1.1/T3 files) or the missing `CardCreatedPage` route (T1.4/T7.1). These are open follow-up work, pending CEO decision on next steps.

## How to Run / Deploy
> Note: given the open UAT findings above, treat any run of this build as **pre-release/dev only** until the schema conflict and routing gap are fixed.

1. **Configure environment:** copy `backend/.env.example` to `backend/.env` and set required values (port, uploads path, DB file path, etc. as defined in that file).
2. **Install dependencies:** run the install step from the root `package.json` (covers both `frontend` and `backend` workspaces as configured).
3. **Development:**
   - Start the backend Express server (serves the API and, once built, the static frontend) per the script in `backend/server.js`.
   - Start the Vite dev server for the frontend (`frontend/vite.config.js`) for hot-reload during UI work.
4. **Production build:** build the frontend with Vite to produce static assets, then run the single Node server (`backend/server.js`) which serves those built assets alongside the `/api/cards` routes and the static `/uploads` folder.
5. **Deploy target:** any generic Node host (e.g. Render, Railway) works out of the box with this single-server model; deploying to Vercel is possible but requires minor adaptation since Vercel expects serverless functions rather than a long-running Express process, and would also need a persistent-storage alternative to local disk for `/uploads` and the SQLite file.
6. **Data/storage:** SQLite database file and the `/uploads` directory are local to the server's disk — ensure the deploy target provides a persistent (not ephemeral) filesystem, or migrate to external storage before scaling beyond a single instance.

## Timeline Log
- **15:42** — PM reads brief, breaks it into 7 tasks (~36h estimated).
- **15:42** — Architect selects stack (React/Vite + Express + SQLite + sharp), plans 20 files.
- **15:42–15:45** — Designer defines UI direction (3 screens, warm celebratory palette) and produces 3 HTML mockups; awaiting approval.
- **15:45–16:02** — Developer builds all 20 files sequentially, each immediately sent through QA (execution check + spec review) and then Security review.
  - **15:54–15:56** — `backend/middleware/upload.js` flagged by Security on attempt 1 (MIME/extension spoofing risk); fixed and cleared on attempt 2.
  - All other files pass QA and Security on first attempt.
- **16:02** — DevOps runs a final execution gate across every file; all pass. Integration report written.
- **16:03** — UAT simulates end-to-end user scenarios against the original brief; **fails** due to (1) conflicting `cards` table schema across `db.js`/`server.js`/`routes/cards.js`, and (2) `CardCreatedPage.jsx` built but not wired into the router. Escalated to CEO for review; project held at this state pending a fix decision.
- **16:03** — Docs agent produces this handover document to record the build-to-date and the open blocking issues for whoever resumes the work.

## Revision — Two launch-blocking bugs surfaced in UAT and need to be fixe

**Client request:** Two launch-blocking bugs surfaced in UAT and need to be fixed before this can ship: First, the 'cards' table schema is currently defined three inconsistent ways across backend/db.js, backend/server.js, and backend/routes/cards.js -- column naming is mismatched ('name' vs 'recipient_name'), and there's ambiguity between a photo_paths JSON column versus a separate card_images table that isn't used consistently. Please consolidate to a single source of truth for the schema (db.js should own the canonical table definition), and update both server.js and routes/cards.js to reference that exact same schema and column names, so that POST /api/cards and GET /api/cards/:id work correctly end to end without mismatches. Second, the confirmation page frontend/src/pages/CardCreatedPage.jsx (which shows the shareable link via ShareLinkBar) exists but was never wired into the router -- frontend/src/main.jsx only defines routes for '/', '/card/:cardId', and a 404 catch-all. Please add the missing route so that after a user submits the create-card form, they're navigated to this confirmation page and can see/copy their shareable link. Both fixes are required for launch sign-off.

**Changes made:**
- CR1 Change request: backend/db.js -> backend/db.js [done]
- CR2 Change request: backend/server.js -> backend/server.js [done]
- CR3 Change request: backend/routes/cards.js -> backend/routes/cards.js [done]
- CR4 Change request: backend/utils/imageProcessing.js -> backend/utils/imageProcessing.js [done]
- CR5 Change request: frontend/src/main.jsx -> frontend/src/main.jsx [done]
- CR6 Change request: frontend/src/pages/CreateCardPage.jsx -> frontend/src/pages/CreateCardPage.jsx [done]


## Revision — Add a password-protected admin dashboard at /admin, accessib

**Client request:** Add a password-protected admin dashboard at /admin, accessible from any browser without server/SSH access, for the site owner and co-owner Manpreet to monitor usage. It must display total cards created and total card views, each broken down by day and by week (not just lifetime totals), plus overall view counts versus unique-device view counts. Implement this by extending the existing getCardViewStats/events-table logic in backend/utils/analytics.js with date-range grouping (daily and weekly) rather than duplicating that logic elsewhere. Access should be gated by a single shared admin credential read from an ADMIN_PASSWORD environment variable, enforced via either a basic login form or HTTP Basic Auth -- a full user-account/auth system is not required. This is a required v2 launch item, not a v3 deferral, and should be scoped and built as part of the current release.

**Changes made:**
- CR7 Change request: backend/utils/analytics.js -> backend/utils/analytics.js [done]
- CR8 Change request: backend/middleware/adminAuth.js -> backend/middleware/adminAuth.js [done]
- CR9 Change request: backend/routes/admin.js -> backend/routes/admin.js [done]
- CR10 Change request: backend/server.js -> backend/server.js [done]
- CR11 Change request: backend/.env.example -> backend/.env.example [done]
- CR12 Change request: frontend/src/pages/AdminDashboardPage.jsx -> frontend/src/pages/AdminDashboardPage.jsx [failed]
- CR13 Change request: frontend/src/main.jsx -> frontend/src/main.jsx [done]
- CR14 Change request: frontend/src/api/client.js -> frontend/src/api/client.js [failed]
- CR15 Change request: frontend/src/styles/admin.css -> frontend/src/styles/admin.css [done]


## Revision — Please add a password-protected admin dashboard at /admin fo

**Client request:** Please add a password-protected admin dashboard at /admin for this v2 release (must ship before launch, not deferred). Access should be gated by a single shared credential read from an ADMIN_PASSWORD env var, via either a basic login form or HTTP Basic Auth — no multi-user accounts needed, since this is just for the site owner and Manpreet (non-technical co-owner) to check stats from any browser without SSH access. The dashboard should display total cards created and total card views, each broken down by day and by week (not just lifetime totals), plus a split between overall views and unique-device views. Backend work should extend the existing getCardViewStats/events table logic in backend/utils/analytics.js to support date-range grouping (daily/weekly) rather than duplicating that logic elsewhere. Please scope and sequence this alongside the other v2 items.

**Changes made:**
- CR7 Change request: backend/utils/analytics.js -> backend/utils/analytics.js [done]
- CR8 Change request: backend/middleware/adminAuth.js -> backend/middleware/adminAuth.js [done]
- CR9 Change request: backend/routes/admin.js -> backend/routes/admin.js [done]
- CR10 Change request: backend/server.js -> backend/server.js [done]
- CR11 Change request: backend/.env.example -> backend/.env.example [done]
- CR12 Change request: frontend/src/pages/AdminLoginPage.jsx -> frontend/src/pages/AdminLoginPage.jsx [done]
- CR13 Change request: frontend/src/pages/AdminDashboardPage.jsx -> frontend/src/pages/AdminDashboardPage.jsx [done]
- CR14 Change request: frontend/src/api/adminClient.js -> frontend/src/api/adminClient.js [done]
- CR15 Change request: frontend/src/main.jsx -> frontend/src/main.jsx [done]
- CR16 Change request: frontend/src/styles/admin.css -> frontend/src/styles/admin.css [done]


## Revision — Please add a new premium template option called "Customized-

**Client request:** Please add a new premium template option called "Customized-card" to the existing style picker: a polaroid-style photo frame layout decorated with balloons, confetti, cake, and party hat graphics that match the app's current celebratory color palette. Label it with a small "premium" badge icon plus a separate small info icon; on hover (desktop) or tap (mobile) the info icon should show the tooltip text "Watch a video to create this one." All users can freely select and preview this template — no restriction there. Separately, implement a real GET /api/config endpoint that returns adsenseClientId, adsenseSlotId, tipJarUrl, rewardedAdClientId, and rewardedAdUnitId, all sourced from environment variables: wire up the existing but currently-unused ADSENSE_CLIENT_ID, ADSENSE_SLOT_ID, and TIP_JAR_URL into server.js, and add two new env vars, REWARDED_AD_CLIENT_ID and REWARDED_AD_UNIT_ID, to both .env.example and server.js/config logic. Finally, gate card creation behavior on this config: when a user selects the Customized-card template and clicks Create, if rewardedAdUnitId is configured, show the rewarded video ad first and only generate and share the card after the ad completes; if rewardedAdUnitId is not set, skip the ad entirely and create/share the card immediately, exactly like every other template.

**Changes made:**
- CR17 Change request: frontend/src/pages/CreateCardPage.jsx -> frontend/src/pages/CreateCardPage.jsx [done]
- CR18 Change request: frontend/src/components/TemplateInfoBadge.jsx -> frontend/src/components/TemplateInfoBadge.jsx [done]
- CR19 Change request: frontend/src/components/CustomizedCardTemplate.jsx -> frontend/src/components/CustomizedCardTemplate.jsx [failed]
- CR20 Change request: frontend/src/components/RewardedAdModal.jsx -> frontend/src/components/RewardedAdModal.jsx [done]
- CR21 Change request: frontend/src/pages/CardViewPage.jsx -> frontend/src/pages/CardViewPage.jsx [done]
- CR22 Change request: frontend/src/api/client.js -> frontend/src/api/client.js [done]
- CR23 Change request: frontend/src/styles/templates.css -> frontend/src/styles/templates.css [done]
- CR24 Change request: backend/routes/config.js -> backend/routes/config.js [done]
- CR25 Change request: backend/server.js -> backend/server.js [done]
- CR26 Change request: backend/.env.example -> backend/.env.example [done]
- CR27 Change request: backend/routes/cards.js -> backend/routes/cards.js [done]
- CR28 Change request: backend/db.js -> backend/db.js [done]
