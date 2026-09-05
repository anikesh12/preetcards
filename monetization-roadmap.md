# Birthday Wishes Card — Monetization Roadmap

All monetization ideas discussed, ranked by effort/friction. Kept here so nothing
gets lost between rounds. Status updated as items move from idea → in progress → live.

## Now building
1. **Watermark on downloaded photos, removable for a fee** — every downloaded memory
   photo carries a small watermark by default; a "Remove Watermark" upsell removes it.
   Free marketing (shared photos carry the brand) + a natural paid upgrade.
2. **Tip jar** — small optional "Support Us" link shown after creating a card. Zero
   friction, zero pressure, costs nothing to have even if barely anyone clicks it.
3. **Ads on non-default occasions** — shown when a user picks anything other than
   Birthday. The analytics/device-tracking groundwork already built exists to keep
   this AdSense-compliant (avoid repeat-traffic/same-device ad serving).

## Later / not started
4. **Free vs. premium collage styles** — Grid free forever; Spotlight/Filmstrip/Scatter
   (or future styles) unlock via a small payment or a rewarded video ad.
5. **Vanity/custom link upgrade** — paid upgrade from `site.com/card/AbCd1234` to
   something like `site.com/card/happy-birthday-priya`.
6. **Sponsored occasion themes** — a local business (bakery, florist, gift shop)
   sponsors a themed collage/occasion pack, gets a small on-card credit.
7. **Affiliate gift suggestions** — "Send a real gift too 🎁" section on the card
   linking out to flowers/cake/gifts via an affiliate program, relevant to the occasion.

## Important dependency note
Items 1–3 need real accounts/credentials only the site owner can set up:
- Tip jar needs a real destination (Buy Me a Coffee / PayPal.me / UPI link).
- Ads need an approved Google AdSense account — **Google will not approve a
  localhost or undeployed site**, so this can only go fully live after deployment.
- Watermark removal "payment" needs a real payment method decided (UPI, Razorpay,
  Stripe, or even just a manual request-based process for v1).

Until those are supplied, the engineering builds the full mechanism with a safe
placeholder/off state, so nothing fake-looking ships to real visitors.
