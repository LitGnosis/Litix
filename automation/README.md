# Litix Warrior — Autonomous Bundle Fulfillment

This additive TypeScript / Next.js / Prisma implementation is based on the actual
production source commit 64a25a3a (October 31, 2026), not the older main branch.
It is NOT yet installed in the active storefront or database.

## Features

- MasterOrder, SubOrder, Supplier, SupplierRoute, BundlePlan/BundleComponent,
  DispatchAttempt, WalletAccount, WalletCredit and CronLease models.
- One verified PayKings settlement can stage 1-31 child orders, routing Followers
  to the selected Instagram/TikTok profile and Likes/Views/Shares to 1-10 post URLs.
- Database-enforced unique parent, child positions, supplier order IDs and wallet
  credit keys; order claims occur before any supplier I/O.
- Up to four concurrent child requests per wave using Promise.allSettled.
- Confirmed rejection selects a different approved funded supplier. Network
  timeouts and lost API responses are quarantined, NEVER blindly replayed.
- Five-minute cycle checks wallet balances (degrades under $50), supplier
  statuses, failed dispatches, cancellation confirmation, partial fulfillment
  and proportional internal wallet credits. Failed suppliers are isolated.
- An accepted cancellation request is NOT proof that an order is canceled.
  A fallback can start only after polling confirms the old attempt terminal.

## Install in a staging clone

From the automation directory:

    npm install
    npm run prisma:validate
    npm run prisma:generate
    npm run typecheck
    npm test
    npx prisma migrate dev --name warrior_initial
    npx tsx src/seed.ts

The existing production site has a different package layout, its own
Boostero-only bundle engine, and existing Neon SQL. DO NOT overwrite it.
First confirm the correct Neon database, run a tested backup and isolated
restore, reconcile existing dispatch ledgers, and apply a reviewed migration.
For production use a committed migration with prisma migrate deploy.

The seed initializes eight disabled Instagram/TikTok bundles with the existing
fixed prices (Launch $53.82, Momentum $107.82, Power $197.82, Apex $359.82)
and their exact existing service quantities. It allocates each fixed package
price proportionally using unit weights [6,3,3,9] for Likes, Views, Shares,
Followers to calculate undelivered store credit. Review this allocation
policy before enabling a plan.

The supplier record is created INACTIVE and NOT APPROVED. Only Boostero is
authorized under the existing owner restriction. No supplier credential is
stored in Prisma; use the already secure BOOSTERO_API_KEY environment variable.
Each approved SupplierRoute must have a live verified service ID and quantity
min/max, a funded wallet, and explicit approval.

## Required environment variables

DATABASE_URL: staging clone or reviewed production DB, which also contains
the existing litix_growth_bundle_orders paid-order source table.
BOOSTERO_API_KEY: established server-only Boostero key.
LITIX_SUPPLIER_HOST_ALLOWLIST: default boostero.com (host-allowlist enforcement).
LITIX_WARRIOR_WEBHOOK_SECRET: minimum 32-character HMAC secret.
CRON_SECRET: existing Vercel cron secret.
LITIX_ALERT_WEBHOOK_URL: optional Discord/Slack-compatible private webhook.
LITIX_WARRIOR_ENABLED: false until integration and staging verification.
LITIX_WARRIOR_DISPATCH_ENABLED: false until canary passed.
WARRIOR_INTERVAL_MINUTES: between 2 and 5, default 5.

## Integration

Copy the route handlers under automation/src/app/api into the real Next.js
src/app/api structure, and the libraries under its lib directory, adjusting
relative imports. Install Prisma and the generated client into the real app,
including a pinned lockfile and reviewed database migrations. Never activate
both the existing growthBundleAutoDispatch and this new engine for the same
payment: existing auto_fulfillment_enabled orders are explicitly rejected.

This new internal settlement endpoint receives signed JSON containing orderId
and postUrls AFTER the current independent NMI verification persists a settled
PayKings payment. HTTP headers:
x-litix-timestamp = current UNIX epoch milliseconds
x-litix-signature = hex HMAC-SHA256(secret,
  timestamp + "." + unmodified JSON request body).

This is NOT an open third-party checkout webhook. It validates the existing
database ledger payment_provider=paykings and payment_state=settled, checks
package price/formula snapshots and refuses Bluevine/manual orders.

On Vercel Pro or Enterprise, add this job to the existing vercel.json crons:

    {"path":"/api/warrior","schedule":"*/5 * * * *"}

Do NOT remove existing Guardian/catalog/backup cron jobs.
Vercel Hobby cron cannot run every five minutes; a persistent Node worker
from npm run worker is an alternative with an always-on host and process
supervisor. The database CronLease isolates concurrent invocations.

## Release gates

1. Apply reviewed schema on a non-production Neon clone and seed plans disabled.
2. Verify the existing checkout and signed post-selection integration.
3. Use mocked suppliers; validate successful order, repeat webhook, timeout
   after upstream acceptance, 5xx, rejected API, insufficient wallet, canceled,
   partial, 30-minute pending and uncertain cancellation.
4. Review price-weight distribution and ensure customer-facing store wallet,
   redemption and notification flows actually use the same ledger.
5. Confirm email, tracking, PayKings settlements, Bluevine manual bundles,
   and other current Litix operations were not altered.
6. Review CI results, deploy protected preview, check Vercel logs and
   independently verify backup recovery before any controlled live promotion.
7. Only enable flags after a live supplier canary has passed.

## Realistic autonomy boundary

100% eternal uptime or guaranteed self-repair is not possible when third-party
APIs and payments can fail. Boostero's v2 API has no order idempotency key.
After an unknown submission receipt, human reconciliation is the safe policy:
blind retries may duplicate supplier charges or customer delivery.
Wallet credit is INTERNAL STORE CREDIT, not a card refund.
