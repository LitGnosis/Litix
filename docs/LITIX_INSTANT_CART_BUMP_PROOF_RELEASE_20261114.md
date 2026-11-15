# Litix instant curated homepage, paid order bumps, receipts, reorder and delivery proof

Branch: `feature/litix-fast-first-paint-cart-bump-proof-20261114`

## Scope and release status

This is a staged payment-sensitive change. The current main storefront remains active until this PR passes final tests, the SQL migration is reviewed/applied on production Neon, and all release gates are verified. This PR does not merge the separate draft supplier-automation PR #214.

### Shipping units

1. The curated Instagram/TikTok platform buttons and six quantity cards render from a **retail-only** static preview on the first React render. Historical estimates are explicitly labeled and never authorize PayKings. `/api/catalog/curated` refreshes current rates silently. The Fast Checkout no longer displays `Preparing the focused checkout…`.
2. New two-line cart checkout: one customer-approved PayKings sale, one parent `ltx2_` order, two SQL line items, one tracking link, distinct Boostero supplier IDs hidden from the browser, each service dispatched with an independently claimed one-way supplier attempt. An unknown outcome is never re-purchased without reconciliation. API suppliers cannot be rolled back transactionally; if one line fails, parent is `MANUAL_REVIEW`, not `COMPLETED`.
3. The contextual bump uses the **live supported offer rate**, not an arbitrary $1.99 / $1.49 or a fake 40% discount. Followers need an additional eligible public post URL for Likes; Likes and Views may reuse the verified post/video URL. An unsupported add-on cannot be charged.
4. Receipts: mobile responsive Resend HTML, order number, itemized prices and quantities, total USD and a `/track/{token}` URL. A paid-only receipt outbox with a bounded retry lease recovers interrupted sends using the existing cron and Resend stable idempotency key.
5. Tracking: authenticated private token or verified checkout-email lookup shows distinct line statuses, reported start counts, remaining quantity and observed completion timestamps. Reorder pre-fills service, quantity and public destination but **never charges** until the customer explicitly enters and authorizes payment.
6. Chargeback evidence: optional proof collection for single-item orders, mandatory for new carts, append-only event history, admin-only JSON / CSV export at `/api/admin/orders/proof?orderId=ltx2_...&format=csv`. Logs include server-observed IP, User-Agent, email, payment transaction, validated public target, supplier IDs, reported initial count, status and observed completion time.

## Required environment values

Set in Vercel **Production** and redeploy. All new flags default to `false`:

- `NEXT_PUBLIC_LITIX_CURATED_STOREFRONT_ENABLED=true` is the existing curated homepage flag; unchanged for live shoppers.
- `NEXT_PUBLIC_LITIX_CART_BUMPS_ENABLED=false` until server and schema tested. Controls visibility only, NOT payment safety.
- `LITIX_CART_BUMPS_ENABLED=false` until SQL migration and tests are done. Required on every server endpoint before a bump can be paid.
- `LITIX_ORDER_PROOF_ENABLED=false` until migration is applied; then `true` to include normal single-item checkouts.
- `LITIX_TRACK_SIGNING_SECRET`: brand-new random 32+ character secret; keep stable. Losing/rotating it invalidates private cart links, so back it up securely.
- Keep existing production `LITIX_BOOSTERO_ENABLED`, `BOOSTERO_API_KEY`, `BOOSTERO_API_URL`, `LITIX_V2_DATABASE_URL` or corresponding Neon connection setting, `NMI_SECURITY_KEY`, `NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY`, `RESEND_API_KEY` or `LITIX_RESEND_API_KEY`, `CRON_SECRET`, and `LITIX_BOOSTERO_ADMIN_TOKEN`. Never place merchant secrets in `NEXT_PUBLIC_` variables.
- `LITIX_CURATED_TIKTOK_35_ENABLED` retains the **existing approved value**; do not change TikTok retail policy as part of this PR.

## Database and sensitive evidence

Before enabling any payment flag, make a restorable Neon backup and apply:
`src/db/migrations/20261114_litix_cart_bump_order_proof.sql`.

This creates:
- `litix_cart_lines`: one paid parent, exactly two supplier-line records with independent one-way claims, per-line start count and supplier-reported completion timestamp.
- `litix_order_proof`: private buyer IP and User-Agent, used only for disputes/support.
- `litix_order_proof_events`: append-only recorded payment/supplier state changes.
- `litix_cart_receipts`: durable paid-only email retry queue.

The IP address is network-observed, not cryptographic proof of a person's identity. Preserve evidence in an access-restricted admin system with a defined retention policy and updated privacy notice. No CVV, raw card number, Collect.js payment token, or private tracking token is stored in these evidence tables.

## Checklist

1. Review current main and PR diff; run the new CI suite: price/selector tests, production build and 390px/1280px no-charge browser scenarios.
2. Apply migration on backed-up production Neon; verify four tables exist and triggers/indexes were installed.
3. Set new HMAC secret and both client/server bump flags **false**. Deploy changes to Production. Confirm ordinary single-item PayKings checkout and /services deep links are unchanged.
4. Test an authenticated read-only `GET /api/admin/orders/proof` on an existing order; do not log admin auth tokens.
5. Enable `LITIX_ORDER_PROOF_ENABLED=true` to capture new ordinary checkouts after migration.
6. Enable both `NEXT_PUBLIC_LITIX_CART_BUMPS_ENABLED=true` and `LITIX_CART_BUMPS_ENABLED=true`; redeploy.
7. Select a valid Followers purchase and an independent public post link for the Likes bump. Confirm exact current retail totals match `/api/checkout/cart-quote` and the final NMI sale. A post link is required even when the base Followers order uses a profile.
8. Place **one supervised low-value actual payment** using an account/post you control. Verify one PayKings transaction, one parent Neon order, exactly two line records, at most one Boostero add per line, both supplier order IDs, one receipt, one private tracking URL and the admin proof summary. Do not make duplicate purchases to test uncertain outcomes.
9. Verify the existing `/api/internal/boostero/cron` schedule is active with `CRON_SECRET` protection. Its bounded runs handle cart receipt retries and child-status polling; do not configure overlapping external schedulers blindly.
10. Verify reorder only navigates/pre-fills and requires a fresh checkout; no charge is triggered from tracking alone.
11. Review first-day order failures and proof events. For rollback, set the client/server bump flags to `false`, redeploy, and **preserve** paid orders, their line records, receipt outbox, and tracking cron. Never revert the database migration while paid cart orders are pending.

## Honest technical limits

Two external Boostero `add` calls cannot be rolled back atomically. This code provides **one atomic payment and SQL order creation**, then independent supplier claims; failed/unknown supplier outcomes are flagged for manual reconciliation. The order proof is timestamped database evidence, not guaranteed legal success in a payment dispute. Supplier-reported `start_count` and completion times are stored only when actually returned/observed.

The page displays **saved retail estimates immediately**, not an invented live rate in 0ms. Live rates update asynchronously before payment can be authorized.
