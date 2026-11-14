# Litix CRO/checkout release notes — 2026-11-14

## Source-of-truth changes
- `src/components/GrowthBundles.jsx`: the fixed-price bundle CTA is always
  available to request a safe, asynchronous PayKings readiness check. A 5-second
  timeout leads to an explicit retry, WhatsApp Concierge link and package review.
  No call to a payment endpoint is sent by this CTA.
- `src/app/bundles/checkout/page.jsx`: readiness can be rechecked without
  refreshing the page. Card fields and payment submission remain gated.
- `src/app/api/catalog/checkout-choices/route.js`: first read the previously
  verified Neon snapshot, limit cold-cache upstream waits to 4.3s, and refresh
  verified supplier catalog data in the background at a bounded cadence.
- `src/components/LitixCheckoutSelector.jsx`: session-cached public package
  choices render immediately on return visits; requests revalidate with a
  five-second abort. The session cache is display-only; it cannot authorize a charge.
- `src/app/page.jsx`: checkout steps are not double-numbered; only one
  checkout section; How It Works, one tracking/concierge section and FAQ.
- `src/app/workspace/page.jsx` and `src/components/LitixWorkspace.jsx`:
  campaign planning, saved services, recent selections and private tracking
  links are grouped on one dedicated page, with local browser persistence.
- `src/components/LitixQuickShop.jsx`: one primary single-service checkout
  CTA and one link to the independent Growth Bundle checkout.

## Payment blockers — a live charge is NOT enabled by this UI change
`src/app/api/bundles/checkout/route.js` currently returns
`FIRST_PARTY_SERVICE_NOT_ENABLED` (HTTP 409) for every bundle POST.
Do not set a storefront button active *as if it charges cards* until the
backend release is independently certified. The new CTA checks readiness,
then offers fallback help if not ready.

`src/app/api/bundles/route.js` checks all of the following before announcing
`checkoutEnabled: true`:
- `VERCEL_ENV=production`
- `LITIX_BUNDLES_LIVE_ENABLED=true`
- `NMI_GATEWAY_MODE=PRODUCTION`
- `NMI_SECURITY_KEY` configured on the **server**
- `NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY` or
  `PAYKINGS_NMI_COLLECT_PUBLIC_KEY` configured
- `LITIX_BUNDLES_DATABASE_URL`, `LITIX_AUTOLIKES_DATABASE_URL`, or
  `LITIX_V2_DATABASE_URL` (one supported DB URL)
- `LITIX_BUNDLES_WHATSAPP_NUMBER` or `NEXT_PUBLIC_WHATSAPP_NUMBER` valid
- Database table `public.litix_growth_bundle_orders` exists.

Merely setting these variables cannot bypass the 409 restriction. A future
payment enablement requires authorization, server-side verified settlement,
idempotent order capture, eligible documented fulfillment, customer receipt,
refund/reversal reconciliation, and safe retry behavior. No cards, supplier
orders or historic paid-order records were modified by this UI change.

## Verification
- `node --test tests/litix-homepage-controls-20261114.test.mjs
  tests/litix-cro-bundles-workspace-20261114.test.mjs
  tests/litix-ai.test.mjs tests/litix-catalog-resilience.test.mjs`
- `npm run build` in `src`.
- Browser tests against mock payment and supplier endpoints:
  `tests/litix-homepage-ui-20261114.mjs`,
  `tests/litix-cro-bundles-ui-20261114.mjs`.
- Confirm the GitHub PR's *actual* Vercel preview readiness before merge and
  the production alias on `litix.net` and `www.litix.net` after promotion.
- Never interpret historical CI tests that demand a retired gateway or supplier
  as authorization to reactivate it.
