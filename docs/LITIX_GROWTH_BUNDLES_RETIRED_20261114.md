# Litix Growth Bundles retired — 2026-11-14

Owner request: remove Growth Bundles completely from active Litix storefront.

## Retired sales
- Removed the Growth Bundle navigation and CTAs from the homepage, hero, workspace,
  service directory, shop, custom-order pages, agency and localized funnels.
- Removed the old offer from sitemap.xml and AI recommendations.
- Removed GrowthBundles.jsx and its storefront stylesheet.
- Legacy /bundles and /bundles/checkout now permanently redirect to /services.
- GET /api/bundles returns HTTP 410 with packages:[] and checkoutEnabled:false.
- POST /api/bundles/checkout (PayKings) and POST /api/bundles/bluevine
  return HTTP 410 without initiating payment or creating supplier orders.
- Existing individual service checkout, PayKings card tokenization, catalog,
  prices, fulfillment routing, and customers' regular order records are untouched.

## Historical records retained intentionally
- The original private /bundles/confirmation page, token-protected
  GET /api/bundles/order, and restricted admin/reconciliation/cron routines
  remain available for orders created BEFORE retirement.
- Keep related payment ledger and order tables until account and settlement
  obligations are resolved. Do not delete or refund customer money blindly.
- At review time the connected neondb table showed one historical bundle record
  with payment_state=awaiting_payment (not proof of payment).
- Retired sale state is enforced by the server and is not dependent on frontend
  hidden buttons or a Vercel environment toggle.

## Required verification
- npm ci && node --test tests/litix-bundles-retired-20261114.test.mjs
  tests/litix-homepage-controls-20261114.test.mjs
  tests/litix-ai.test.mjs tests/litix-catalog-resilience.test.mjs
- npm run build
- Browser smoke tests: homepage and /workspace contain no bundle CTA,
  old /bundles routes redirect, retired purchase APIs return HTTP 410, and
  historical /bundles/confirmation route remains reachable.
- Confirm both litix.net and www.litix.net aliases point to the successful
  GitHub main commit before declaring production complete.
