# UAT Report

**Result: FAIL**

## Scenarios Checked
- User fills out form with name, message, and uploads 2-4 photos, then submits to create a card
- User is redirected to a confirmation/created page showing the shareable link after submission
- User opens the shareable card link to view the rendered card with photos on desktop
- User opens the shareable card link on a mobile browser (Android/iOS) to check responsiveness
- User uses the copy-link/share button to share the card

## Notes
Per the DevOps integration report, the app has a critical, unresolved backend schema conflict: 'cards' table is defined three different ways across db.js, server.js, and routes/cards.js (mismatched column names 'name' vs 'recipient_name', and JSON photo_paths column vs a separate normalized card_images table with no photo_paths at all). Because better-sqlite3 will create whichever schema initializes first and other modules' queries won't match, card creation (POST /api/cards) will very likely throw a runtime error when inserting photos/recipient data, or the GET /api/cards/:id will fail to return the expected fields — meaning the core scenario of 'fill form -> submit -> get shareable card' is broken or unreliable. Additionally, CardCreatedPage.jsx (the confirmation page with the ShareLinkBar showing the shareable URL) is built but not wired into the router in main.jsx, which only has routes for '/', '/card/:cardId', and a 404 catch-all — so after submitting the form there is no route to land on this confirmation experience as designed in the brief. These are launch-blocking issues: the primary user flow (create card -> get link -> view/share) cannot be verified to work end-to-end and directly contradicts the DevOps report's own findings. This needs to be fixed (single schema source of truth, and CardCreatedPage route added/used in the submit flow) before this can be considered ready to ship.
