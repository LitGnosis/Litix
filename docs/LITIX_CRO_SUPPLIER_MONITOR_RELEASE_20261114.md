# Litix CRO, SEO, Public Preview and Supplier Monitoring — November 14, 2026

## Scope and deployment state

This is an additive, reviewable feature-branch change for the actual Litix Next.js
App Router app in `src/`. It does not merge automatically, enable paid supplier
dispatch, update payment keys, issue refunds, or apply a production database migration.
The storefront currently still uses the established Boostero checkout branch; it
is NOT migrated to independent first-party fulfillment by this change.

The following established protections remain untouched:
- server-side live price and minimum/maximum validation before PayKings payment
- durable PayKings order idempotency, supplier dispatch claim, and one-way add attempts
- unknown supplier outcomes require reconciliation, never blind second supplier adds
- multi-post paid orders retain the existing separate child-order ledger

## Checkout and pricing

`src/app/page.jsx` hides the unavailable Auto-Likes checkout toggle.
New Auto-Likes purchases stay suspended.
`src/components/PremiumInlineCheckout.jsx` has one concise trust strip under the CTA.
The duplicated hero trust strip is removed.
`src/lib/litixCuratedSavings.mjs` calculates a live, cents-accurate
`Save $X.XX (Y%)` badge **only when two available quote cards support it**.
A badge does not create a discount. We deliberately do not impose the requested
10/18/24/30% automatic discounts without synchronizing all server billing
quotes and proving they remain within the 60% wholesale markup, $1 minimum,
$9/1,000 followers floor, and $6/1,000 Likes floor. Showing a fabricated
30% discount on a quote that still charges full price is prohibited.

## Social profile/post preview

`GET /api/social/preview?platform=instagram|tiktok&username=@handle`
returns normalized `avatar`, `followerCount` (nullable),
`posts` (up to 12), `publicProfileVerified` and `asOf`.
It uses public Apify data, a private 600-second Redis cache, 10-minute Redis
request rate limits, and fail-closed provider errors. It returns no invented
profile details. The existing `/api/post-picker` and direct post URLs remain
as fallbacks for customers.
`src/components/SocialMultiPostChooser.jsx` displays public avatar, follower
count if returned, thumbnails and even quantity re-allocation. Paid multi-post
fulfillment is still limited to previously supported approved Instagram/TikTok
Likes services; do NOT advertise Views/Comments multi-post until their paid
child-order dispatch has been built and verified.

Env (secret values must be set privately in Vercel):
- `LITIX_POST_PICKER_ENABLED=true`
- `APIFY_TOKEN`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
  (or `REDIS_REST_URL` and `REDIS_REST_TOKEN`). This API uses Upstash's
  HTTPS REST interface, not the existing TLS `REDIS_URL` BullMQ connection.

## Trial

`GET /free-trial` is a gated customer form.
`POST /api/free-trial` validates same-origin POST + CAPTCHA + a live service
mapped explicitly to the requested platform/kind, an exactly 20-unit
eligible minimum/maximum, per-claim supplier cost and balance. It claims a
per-IP/email/handle 30-day entitlement atomically in PostgreSQL and consumes
an at-most-50/day global budget before **one and only one** supplier add.
Unknown outcomes stay in the ledger as `UNKNOWN_OUTCOME` and cannot be
automatically replayed.

Migrate `src/db/migrations/20261114-free-trial-claims.sql` only after
taking a backup and validating the target Neon branch. Trial is OFF by default.
Required variables **before deliberate release**:
- `LITIX_FREE_TRIAL_ENABLED=true`
- `NEXT_PUBLIC_LITIX_FREE_TRIAL_ENABLED=true`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- `LITIX_TRIAL_HASH_SECRET` (40+ character random secret, server-only)
- `LITIX_TRIAL_INSTAGRAM_LIKES_SERVICE_ID` or
  `LITIX_TRIAL_INSTAGRAM_VIEWS_SERVICE_ID` or
  `LITIX_TRIAL_TIKTOK_LIKES_SERVICE_ID` or
  `LITIX_TRIAL_TIKTOK_VIEWS_SERVICE_ID` (actual verified service IDs only)
- `LITIX_FREE_TRIAL_MAX_COST_USD` (optional; default 0.30, hard maximum 1.00)
- Existing: `LITIX_BOOSTERO_ENABLED`, `BOOSTERO_API_KEY`,
  `BOOSTERO_API_URL` (must be the allowlisted https://boostero.com/api/v2)
  and one of `LITIX_BOOSTERO_DATABASE_URL`, `LITIX_V2_DATABASE_URL`,
  `DATABASE_URL`, `POSTGRES_URL`.

Do NOT activate promotional claims before verifying profile/post ownership,
service supplier authorization and abuse budgets. A public post link is not
always proof that its submitter owns that profile. CAPTCHA and IP/email
limits reduce abuse but cannot eliminate it.

## Operational telemetry and alerts

`GET /api/telemetry` returns verified rolling 24-hour completed count,
processing count and approved active-service count read from Neon.
`avgStartMinutes=null` until actual delivery-start timestamps are captured.
No fake delivery times, reviews, or start-time statistics are shown.

Feature gate `LITIX_BOOSTERO_MONITOR_V2_ENABLED=true` (OFF by default).
All monitoring endpoints require `Authorization: Bearer CRON_SECRET`,
Vercel production, and configured Boostero, database and existing supplier keys.
The new Vercel Cron Jobs run:
- `/api/internal/boostero/monitor` every 2 minutes: atomically claims up to
  100 existing **paid** submitted orders, queries batch status, validates
  quantity and supplier order IDs, updates the ledger and durable email outbox.
- `/api/internal/boostero/catalog` every 30 minutes: validates current
  eligible supplier offerings and deactivates approved services whose live
  rates/limits violate the existing markup or approval ceiling. Never
  silently re-enables a disapproved service.
- `/api/internal/boostero/balance` every 15 minutes: alerts the owner via
  Resend if balance below $20, with an idempotency key per 15-minute window.
  Supply `RESEND_API_KEY` or `LITIX_RESEND_API_KEY` for email alerts.

`src/lib/boosteroResilientRead.mjs` permits 3 attempts with exponential
backoff **only** for side-effect-free `status`, `services` and `balance`.
The existing `add` and `refill` operations remain one-shot. The
current supplier HTTP client has 15-second per-request timeouts.
The monitor may not process all 100 orders within an invocation under
pathological database latency; observe cron durations and tune batch size.

## Reconciliation / refund safety

Migrate `src/db/migrations/20261114-boostero-shortfall-reconciliation.sql`
to create the read-only view `public.litix_boostero_shortfall_reviews`.
It calculates a proposed prorated credit amount in cents for **known**
remaining quantities on paid orders marked FAILED/MANUAL_REVIEW/UNKNOWN_OUTCOME.
`src/lib/fulfillment/failover.mjs` produces the same bounded proposal
in application code. These tools **do not** create a refund or replacement.
A failed/partial supplier status cannot establish that the order has not
delivered and that a replacement will not duplicate fulfillment.
Reconciliation of gateway capture, final supplier quantity and backup service
authorization is required before any irreversible action.

## SEO

Four existing canonical curated landing pages remain unchanged:
`/buy-instagram-followers`, `/buy-instagram-likes`,
`/buy-tiktok-followers`, `/buy-tiktok-likes`.

Seven new static, indexable App Router routes in
`src/app/[slug]/page.jsx`:
`/buy-tiktok-views`, `/buy-instagram-views`,
`/buy-youtube-subscribers`, `/buy-youtube-views`,
`/buy-x-followers`, `/buy-x-likes`, `/buy-x-retweets`.
They use canonical metadata, FAQ/Product/Breadcrumb JSON-LD
**without false price offers**, and initialize catalog filtering by
platform/kind. They are in `src/app/sitemap.js`. The existing product
checkout still happens through its separately live-verified service route.

## Deployment order / checks

1. Inspect the real-domain Vercel project `litix_final_logo_corrected_vercel_ready`
   (aliases `www.litix.net` and `litix.net`), not one of many older Litix
   Vercel compatibility projects. Its Next.js root directory is `src`.
2. Run `cd src && npm ci --no-audit --no-fund && node --test tests/litix-cro-reliability-20261114.test.mjs tests/litix-seo-first-paint-20261114.test.mjs tests/litix-micro-ux-20261114.test.mjs tests/checkout-cro-20261114.test.mjs && npm run build`.
3. Test preview on mobile, checkout mock payment flow, invalid profile/link paths,
   free-trial CAPTCHA, concurrent entitlement claims, recorded status transitions,
   low-balance alerts and cancellation/partial manual review with a staging Neon clone.
4. Apply reviewed **additive** SQL migrations only to the confirmed production
   branch after a backup; check columns and existing constraints before changes.
5. Set keys/gates only for verified, approved functionality; leave trial and
   supplier monitor gates OFF until the staging audit and merchant approval.
6. Never use a real customer card or money for smoke tests without explicit,
   independent owner authorization. Do not merge or promote a failing preview.

The verified Vercel preview build is not a live payment end-to-end test.
This PR does not claim 99.99% measured uptime, actual micro-order delivery,
the requested arbitrary tier discounts, a complete TypeScript migration,
automatic refunds, supplier failover, or a first-party supplier conversion.
