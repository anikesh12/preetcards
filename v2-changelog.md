# Birthday Wishes Card — V2 Change Log

Running list of changes made after v1 delivery. Used to generate the v2 quotation
once this round of iteration is signed off — same proposal process as v1, just
applied to this list of tasks instead of a fresh brief.

| # | Change | File(s) | Est. hours |
|---|--------|---------|------------|
| 1 | Restyled the creation page to match the card view's celebratory branding — form was rendering nearly unstyled (CSS classes didn't match the JSX), now has a proper card container, styled inputs, dashed dropzone, and a bold CTA button consistent with the rest of the app | `frontend/src/pages/CreateCardPage.jsx` | 2 |
| 2 | Added 4 selectable photo collage layouts (Grid, Spotlight, Filmstrip, Scatter/polaroid) — new DB column + validated API field, a visual style picker on the creation form with mini preview icons for each option, and 4 distinct CSS layouts on the card view page. Verified end-to-end (all 4 layouts tested with real uploaded photos) | `backend/db.js`, `backend/routes/cards.js`, `frontend/src/pages/CreateCardPage.jsx`, `frontend/src/pages/CardViewPage.jsx` | 6 |
| 3 | Made the app occasion-agnostic instead of birthday-only — new "Occasion" dropdown on the creation form (Birthday, Anniversary, Wedding, Engagement, Congratulations, New Baby, Get Well Soon, Farewell, Retirement, Thank You), stored + validated on the backend, and the card view heading now adapts to the chosen occasion (e.g. "Happy Anniversary, Meera & Raj!"). Verified with cards created across multiple occasions | `backend/db.js`, `backend/routes/cards.js`, `frontend/src/pages/CreateCardPage.jsx`, `frontend/src/pages/CardViewPage.jsx` | 4 |

| 4 | Added internal-only analytics: an `events` table logging every card creation and card view (IP → city/country via offline geo lookup, parsed browser/OS/device type, referer, and an anonymous device cookie so repeat visits from the same browser are recognized without identifying anyone). Computes both overall (every hit) and unique-device view counts per card — not shown to end users, queryable on demand via a `scripts/stats.js` lookup script for billing/ad-eligibility decisions later. Verified with a multi-device simulation (repeat views from one "device" correctly don't inflate the unique count; separate devices do) | `backend/db.js`, `backend/server.js`, `backend/routes/cards.js`, `backend/utils/analytics.js`, `backend/scripts/stats.js` | 5 |

| 5 | Added watermarked photo downloads — each memory photo on the card view page gets a download button that returns a JPEG with a "Birthday Wishes 🎉" badge composited into the corner (sized proportionally, safe even for very small images), plus a "Remove Watermark" upsell button (currently a "coming soon" placeholder, ready to wire to real payment later). Verified with both an edge-case tiny image and a realistic-sized photo — watermark renders correctly, no crashes | `backend/utils/watermark.js`, `backend/utils/imageProcessing.js`, `backend/routes/cards.js`, `frontend/src/pages/CardViewPage.jsx` | 5 |
| 6 | Added an optional tip jar link on the card confirmation page ("☕ Enjoyed this? Support us") — only shows if a `TIP_JAR_URL` is configured, otherwise stays hidden. Also fixed `.env` files never actually being loaded (the file existed but nothing read it since v1 — a pre-existing gap, not something this feature introduced) | `backend/server.js`, `backend/.env.example`, `frontend/src/pages/CardCreatedPage.jsx` | 2 |
| 7 | Added an ad slot on non-Birthday occasion cards — shows a real Google AdSense unit once `ADSENSE_CLIENT_ID`/`ADSENSE_SLOT_ID` are configured, or a neutral layout placeholder before that (AdSense requires a live site to approve an account, so the placeholder lets the layout ship now) | `backend/server.js`, `backend/.env.example`, `frontend/src/components/AdSlot.jsx`, `frontend/src/pages/CardViewPage.jsx` | 3 |

**Running total: 27 hours**

## Planned (not yet started)
- Real payment wiring for "Remove Watermark" (needs a decision: UPI, Razorpay, Stripe, or a manual request process for v1).
- A real AdSense account + tip jar destination link — both need to be supplied by the site owner once the site is deployed live.
- Items 4–7 from the [monetization roadmap](monetization-roadmap.md) (premium collage styles, vanity links, sponsored themes, affiliate gift suggestions).
