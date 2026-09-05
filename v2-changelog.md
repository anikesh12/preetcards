# Birthday Wishes Card — V2 Change Log

Running list of changes made after v1 delivery. Used to generate the v2 quotation
once this round of iteration is signed off — same proposal process as v1, just
applied to this list of tasks instead of a fresh brief.

| # | Change | File(s) | Est. hours |
|---|--------|---------|------------|
| 1 | Restyled the creation page to match the card view's celebratory branding — form was rendering nearly unstyled (CSS classes didn't match the JSX), now has a proper card container, styled inputs, dashed dropzone, and a bold CTA button consistent with the rest of the app | `frontend/src/pages/CreateCardPage.jsx` | 2 |
| 2 | Added 4 selectable photo collage layouts (Grid, Spotlight, Filmstrip, Scatter/polaroid) — new DB column + validated API field, a visual style picker on the creation form with mini preview icons for each option, and 4 distinct CSS layouts on the card view page. Verified end-to-end (all 4 layouts tested with real uploaded photos) | `backend/db.js`, `backend/routes/cards.js`, `frontend/src/pages/CreateCardPage.jsx`, `frontend/src/pages/CardViewPage.jsx` | 6 |

**Running total: 8 hours**
