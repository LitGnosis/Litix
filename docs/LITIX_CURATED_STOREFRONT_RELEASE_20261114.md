# Litix curated Instagram / TikTok storefront — controlled release

This PR is a feature-gated design and pricing update. It is intentionally a **draft** until real supplier matches and one supervised payment have been verified. It does not require a new database schema. It reuses the existing Neon order ledger, the PayKings Collect.js checkout, and the atomic Boostero add-claim.

## Deployment configuration

Configure these on the existing Vercel project under Production:

- `NEXT_PUBLIC_LITIX_CURATED_STOREFRONT_ENABLED=false` (default). Set `true` and **redeploy** only after the curated visual selector is approved and the live product API returns at least one supported service per desired type.
- `LITIX_CURATED_TIKTOK_35_ENABLED=false` (default, server only). Set `true` only after reviewing the change from the existing 60% retail markup to a strict 35% markup for exact matched TikTok Default services.
- Retain existing `LITIX_BOOSTERO_ENABLED=true`, `BOOSTERO_API_KEY`, `BOOSTERO_API_URL=https://boostero.com/api/v2`, `LITIX_V2_DATABASE_URL` (or configured production database alias), `NMI_SECURITY_KEY`, `NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY`, and Resend credentials.

Feature flags are independent:
- Neither flag enabled: production UI and existing rates do not change.
- Curated homepage only: new UI, **existing 60% TikTok rates**; all prices still reverified before payment.
- TikTok 35% flag only: exact matched Default TikTok services are repriced across the app, including the legacy catalog, so do **not** enable this flag without a checkout/regression review.
- Both flags enabled: curated homepage and 35% TikTok pricing, subject to the existing $1.00 minimum charge.

## Strict product discovery

`src/lib/tiktokCatalog.mjs` matches exact named Boostero service and/or category patterns. The resolver re-reads Boostero `action=services` before preflight and **again** in `/api/checkout/v1`, then uses the existing payment handler to independently re-quote the supplier service. Suppliers can change, so missing or changed IDs never trigger speculative fallback purchase.

The client receives a Litix-only SKU such as `curated_tiktok_likes_standard`; no numeric supplier ID, wholesale cost, margin or markup is included in `/api/catalog/curated`. Existing `/services` remains the full public catalog.

## Price contract

For a matching active TikTok Default service:

```js
const rateCents=Math.ceil(Number(wholesaleRateUSD)*1.35*100-1e-9);
const totalCents=Math.max(99,Math.round(Number(quantity)*rateCents/1000));
```

A 99-cent computed quote does **not** authorize PayKings billing: existing Litix payment logic requires a minimum of 100 cents. Package tiles below that minimum are disabled; a valid custom quantity >= $1 is required. This difference is deliberate to prevent mismatches with the production charge ledger.

Instagram and unmatched TikTok inventory retain existing 60% retail pricing and published floor rules.

## Guarantees and recurring services

- `MOST POPULAR`, `BEST VALUE`, `Save 15%` and `Save 25%` are **not** shown without authenticated conversion data or documented volume discounts. The 1,000-unit card is highlighted `FEATURED` instead.
- No promised delivery speed, retention, "Non-Drop", 30-day refill protection or 256-bit encryption rating is fabricated from generic source listing text.
- AutoLikes / AutoViews and future-post subscriptions remain retired for new purchases. The add-on checkbox is clearly **disabled and uncharged**; the secondary TikTok Auto Likes/Views buttons are disabled.
- Custom Comments (non-Default supplier type) and Story Views (distinct public-link format) are not charged until a matching API fulfillment contract has been implemented and tested.
- VIP is offered only when a different live Default supplier listing explicitly indicates real/active-look profiles. No supplier fallback ID is guessed.

## Safety checks before enabling

1. Verify source-code PR CI is green: targeted supplier match and pricing tests, production Next.js build, and no-charge Playwright UI checks at 390px and 1280px.
2. Keep flags OFF, merge only after review, and verify existing PayKings checkout remains reachable with a normal `/services` deep link `/?service=litix_...#checkout`.
3. In a read-only environment, inspect `GET /api/catalog/curated` for the eight possible core pairs; confirm which current service types actually return. No data from that endpoint is guaranteed until a live supplier snapshot succeeds.
4. Set **UI flag only**, redeploy, and verify card quantity, cross-service switching, disabled unavailable buttons, mobile layout, and absence of supplier ID/cost in JSON.
5. Set **35% flag only after operator review** and redeploy. Confirm the storefront price, independent `/api/checkout/readiness` quote, and `/api/checkout/v1` captured amount match. Provider purchase is one-way claimed and must never be replayed on timeout.
6. Run one supervised low-value live sale on a public social-media target you control, if permitted by provider policy. Verify exactly one PayKings transaction, exactly one Boostero supplier add, one Neon order, one confirmation email and functioning private tracking. Stop if any step is ambiguous; don't repeat payment or supplier add.
7. Monitor early orders, revert flags and redeploy if any price mismatches or unavailable-service issues occur.

This PR does not merge the separate draft PR #214 or enable its background scheduler. No automatic refunds, refills or backup supplier orders are introduced.
