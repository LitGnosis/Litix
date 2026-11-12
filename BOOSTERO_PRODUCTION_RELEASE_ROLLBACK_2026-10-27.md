# LITIX Boostero Production Release & Rollback — 2026-10-27

## Scope and immutable baseline
- Feature PR: #51, branch `feature/boostero-preview-readonly-20261027`.
- Pre-release production Git SHA: `91ab02bdc9e393236846a3b9462ed31185ff3021`.
- Pre-release production Vercel deployment: `dpl_DY4oDb7GtcCV3pDHuKRCbJu7czdb` — kept available as a rollback candidate.
- Existing SMMGLOB service IDs are numeric and continue through their **untouched** checkout handler.
- Boostero IDs use `boostero_<supplier_service_id>`; only the explicitly enabled allowlist can be shown or ordered.

## Production data protection
- Neon project: `fancy-wave-75069167`, primary branch `br-long-term-awmdp29b` (`neondb`).
- An attempt to create a new pre-release Neon branch **failed**: branch quota exceeded.
- An attempt to create a new pre-release Neon snapshot **failed**: snapshot quota exceeded.
- An existing, older full Neon snapshot is `snap-fragrant-hat-awyjlty1` (2026-10-25); this is **not a new pre-release snapshot**.
- A transactionally created internal backup exists at `litix_release_backups.v2_orders_pre_boostero_20261027` with **5 of 5 original order rows**, and zero JSON row differences from `public.litix_v2_orders` immediately before migration.
- The migration `src/db/migrations/20261027-boostero-fulfillment.sql` only adds three Boostero tables and indexes; it does not alter the existing Litix orders table.
- The production allowlist includes supplier **#5461** at $15.00 retail/1,000 with a $3.00 wholesale ceiling, currently `enabled=false`. No purchases/attempts were created.

## Environment gates and secrets
- `LITIX_BOOSTERO_DATABASE_URL`: sensitive, Production, points to Neon primary branch.
- `LITIX_BOOSTERO_ADMIN_TOKEN`: generated server-to-server with a cryptographic 384-bit secret and stored Sensitive in Production; never log or return it.
- Existing `BOOSTERO_API_KEY` remains Sensitive; other payment keys are unchanged.
- `LITIX_BOOSTERO_ENABLED=false` in Production **must remain false until explicit owner approval and verification**. With false, catalog has no Boostero listing and add/refill/status/purchases fail closed.
- Private admin endpoint requires exact constant-time bearer-token verification; the public customer handler permits only `card_purchase`, never admin purchase/refill. Strict DB allowlist, live pricing/margin, quantity, canonical URL and wallet checks apply.

## Recovery procedures (do not execute without explicit approval)
1. **Immediate supplier stop**: set `LITIX_BOOSTERO_ENABLED=false` in Vercel Production and redeploy so the updated variable is effective. All other SMMGLOB services continue unchanged.
2. **Code rollback**: redeploy/promote the saved production deployment `dpl_DY4oDb7GtcCV3pDHuKRCbJu7czdb` or its original SHA `91ab02b`; verify existing catalog, orders and PayKings checkout. Preserve Boostero order ledgers during recovery.
3. **Database rollback**: because the schema is additive, do **not** drop new Boostero tables after real purchases; retain as audit records. If there are provably zero Boostero fulfillment/attempt rows and explicit approval is given, a DBA may reverse only these new tables and indexes. Never delete or overwrite existing Litix orders or their historical payments. Use internal backup only as a reconciliation reference; do not blindly restore data over newer customer orders.
4. **Ambiguous supplier add**: DO NOT retry an `UNKNOWN_OUTCOME` item. Reconcile the current Boostero balance and order ID with the supplier before manual resolution; never repeat a customer's charge.
5. **Admin key rotation**: regenerate the Sensitive Production env var, redeploy, invalidate old token. No API secrets in source/console logs.

## Pre-first-purchase release gate
- Review and select exact Boostero service, verified latest rate and max wholesale, approved retail, exact quantity and a **public Instagram or TikTok profile**. Explicitly approve total cost before any supplier spend.
- Determine whether this order is a real customer PayKings purchase (Collect.js token) or an explicit authenticated owner wallet purchase. Never use fake success to claim a live transaction.
- Add/approve only the specific service in the production allowlist; keep global flag false until the above is confirmed.
- Run a single authorized real purchase, store unique Boostero supplier order ID alongside unique Litix order and gateway transaction, reconcile supplier status and email confirmations.
- Only after that verified first live paid/admin fulfillment can Boostero be opened more broadly. NMI signed payment callbacks were **not** assumed or enabled; PayKings is currently used through the existing direct server-side approved-sale response.
