# Litix automated PayKings → Boostero fulfillment: deployment contract

This release **extends** the existing working `/api/checkout/v1` and `public.litix_v2_orders` ledger. It does not replace live PayKings tokenization, the stored supplier service ID, original quote validation, or the one-way `QUEUED -> DISPATCHING` supplier order claim.

## Deployment sequence

1. Keep `LITIX_AUTOMATED_FULFILLMENT_ENABLED` unset / `false`.
2. Confirm the production Neon connection used by `LITIX_BOOSTERO_DATABASE_URL` (fallback `LITIX_V2_DATABASE_URL` / `DATABASE_URL`) points to the database containing `public.litix_v2_orders` and `public.litix_boostero_fulfillment`. The audited Neon project is `fancy-wave-75069167`.
3. Back up that production database. Review and run `src/db/migrations/20261114-litix-paykings-fulfillment-automation.sql`. Its new transaction-ID unique index must be checked against existing real orders first.
4. Configure the following Vercel **server-side only** variables (do not place their values in GitHub or logs):
   - `NMI_WEBHOOK_SIGNING_KEY`: signing key from the configured NMI transaction webhook (different from the payment security key).
   - `NMI_SECURITY_KEY`: existing PayKings/NMI transaction query and sale key.
   - `LITIX_TRACK_SIGNING_SECRET`: random, private, at least 32 characters.
   - `CRON_SECRET`: strong existing bearer secret; Vercel cron attaches it to calls.
   - `BOOSTERO_API_KEY`, `BOOSTERO_API_URL=https://boostero.com/api/v2`, `LITIX_BOOSTERO_ENABLED=true`.
   - `RESEND_API_KEY` and verified sender `orders@litix.net`.
   - `LITIX_HIGH_VALUE_BALANCE_CHECK_CENTS=10000` (optional, $100 preflight threshold; balance alert threshold is $50).
5. In NMI Merchant Portal, register `https://www.litix.net/api/webhooks/paykings` for `transaction.sale.success` and `transaction.capture.success` events. Use its Webhook-Signature secret, not any customer token.
6. Deploy and confirm `/api/cron/sync-orders`, `/api/cron/sync-services`, and `/api/health/fulfillment` are authenticated and fail closed.
7. Check the account's Vercel cron plan. A 2-minute schedule requires a plan that supports sub-daily cron runs (e.g. Vercel Pro); Hobby daily-only cadence is not enough.
8. Enable `LITIX_AUTOMATED_FULFILLMENT_ENABLED=true` **only after** migration, webhook signature tests, database authorization and staging tests pass. Keep `LITIX_AUTOMATED_REFILL_ENABLED=false` until the customer refill policy and supplier eligibility contract are independently approved.
9. Test the webhook with a signed non-live fixture first. Then verify **one authorized small real customer transaction** in a supervised window with matching gateway receipt, one supplier attempt, one supplier order ID, and a working private tracking link. Never replay `add` as a test.

## Behavior and safety

- A signed PayKings webhook alone cannot spend supplier balance. The server verifies the payment's exact order, amount and transaction ID against NMI's Query API.
- The original checkout remains the primary payment-and-dispatch path. The webhook is a **recovery and reconciliation route**, not an independent payment creation endpoint.
- An existing supplier order or one-way dispatch claim blocks a second purchase. Network errors after dispatch starts are recorded as `UNKNOWN_OUTCOME` and held for manual reconciliation. Only definite pre-dispatch insufficient-balance results can be retried, up to three total attempts with exponential backoff.
- Daily `action=services` snapshots update real service IDs, minimums, maximums, and wholesale rates. Confirmed missing service IDs are temporarily suppressed from storefront selection, and every checkout still validates the live quote. Never use sample IDs `101`, `102`, `103`, `205` or `206` as if verified.
- Supplier `Partial` and `Canceled` statuses are **manual review**. The database records reported remaining units, original supplier charge and a provisional wholesale-credit estimate. That is **not proof of supplier wallet credit** and does not authorize a new Boostero order or PayKings refund.
- Balance is checked at the supplier before dispatch and by cron; balances under $50 trigger an idempotent daily admin alert.
- Customers receive normal checkout confirmation through existing Resend. A webhook-recovered paid order is queued for a private-link confirmation with an idempotent email key. The tracking link points to `https://www.litix.net/track/[signed-token]`.
- The customer refill button only appears when a completed paid order maps to a currently live API-refill-eligible supplier service. Requests are one-way claimed in Neon. Supplier action requires the separate explicit refill feature flag.
- No credit-card number, NMI key, Boostero key, personal tracking token, or customer email is put into analytics logs.

## Operational API surfaces

| Route | Access | Function |
| --- | --- | --- |
| `POST /api/webhooks/paykings` | NMI Webhook-Signature | Verified capture reconciliation and already-claimed dispatch |
| `GET /api/cron/sync-orders` | CRON_SECRET bearer | Retry, batch status, partial reviews, email outbox, balance |
| `GET /api/cron/sync-services` | CRON_SECRET bearer | Daily supplier service availability/rate scan |
| `GET /api/health/fulfillment` | CRON_SECRET bearer | Supplier wallet health, $50 admin threshold |
| `POST /api/orders/lookup` | Email + order ID | Existing private order lookup, trim/lowercase |
| `GET /api/orders/track?token=...` | HMAC-signed private token | Current recorded delivery milestones |
| `POST /api/orders/refill` | Private token + strict policy | Once-only customer refill request |
| `GET /track/[token]` | HMAC-signed private token | Customer-facing self-serve progress |

Do not use an Express in-memory Map with Vercel serverless or a second webhook handler that accepts caller-submitted `approved` text. There is no Boostero sandbox; no real supplier `add` occurs in the automated test suite.
