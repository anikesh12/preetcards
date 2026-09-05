# Birthday Wishes Card — V2 Change Log

Running list of changes made after v1 delivery. Used to generate the v2 quotation
once this round of iteration is signed off — same proposal process as v1, just
applied to this list of tasks instead of a fresh brief.

| # | Change | File(s) | Est. hours |
|---|--------|---------|------------|
| 1 | Restyled the creation page to match the card view's celebratory branding — form was rendering nearly unstyled (CSS classes didn't match the JSX), now has a proper card container, styled inputs, dashed dropzone, and a bold CTA button consistent with the rest of the app | `frontend/src/pages/CreateCardPage.jsx` | 2 |
| 2 | Added 4 selectable photo collage layouts (Grid, Spotlight, Filmstrip, Scatter/polaroid) — new DB column + validated API field, a visual style picker on the creation form with mini preview icons for each option, and 4 distinct CSS layouts on the card view page. Verified end-to-end (all 4 layouts tested with real uploaded photos) | `backend/db.js`, `backend/routes/cards.js`, `frontend/src/pages/CreateCardPage.jsx`, `frontend/src/pages/CardViewPage.jsx` | 6 |
| 3 | Made the app occasion-agnostic instead of birthday-only — new "Occasion" dropdown on the creation form (Birthday, Anniversary, Wedding, Engagement, Congratulations, New Baby, Get Well Soon, Farewell, Retirement, Thank You), stored + validated on the backend, and the card view heading now adapts to the chosen occasion (e.g. "Happy Anniversary, Meera & Raj!"). Verified with cards created across multiple occasions | `backend/db.js`, `backend/routes/cards.js`, `frontend/src/pages/CreateCardPage.jsx`, `frontend/src/pages/CardViewPage.jsx` | 4 |

**Running total: 12 hours**

## Planned (not yet started)
- Ad placement shown when a user selects an occasion other than Birthday (monetization for non-default occasions) — pending a decision on ad network/placement approach.
- Device/analytics tracking on card creation (unique device counts for usage analytics) — pending a decision on what to track and where it's stored/viewed.
