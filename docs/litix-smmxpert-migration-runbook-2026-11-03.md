# Litix → SMMXPERT supplier migration (approved provider, NOT YET LIVE)
Decision: November 3, 2026. The owner selected SMMXPERT as the preferred new-order supplier.

## Current production state
- Active checkout, Boostero fulfillment and existing supplier-ID tracking are unchanged.
- SMMXPERT account is present in the owner's screenshot, but API credentials have **not** been made available to the Litix deployment.
- SMMXPERT new-order routing is **NOT active**. No deposits, trial charges, supplier orders or historical-order migrations were performed.
- A previous SMMXPERT support email attempt was blocked; do not claim an accepted vendor partnership or emailed authorization.

## Confirmed API contract
- Vendor documentation: https://smmxpert.com/api
- Fixed endpoint: `https://smmxpert.com/api/v2` via form-encoded POST with `key` and `action`.
- Read-only actions: `services`, `balance`, and `status` (single ID or comma-separated list of up to 100 IDs).
- Purchase action (not wired): `add` with service ID, link and quantity.
- Do not call `add`, `refill` or `cancel` during qualification.
- Supplier status can be Pending, In progress, Processing, Completed, Partial or Canceled; verify actual wallet credits and fulfillment.
- API's illustrative balance shows `currency:"USD"` while the owner's signed-in dashboard displays **INR**. Treat the currency from the *actual authenticated account* as authoritative, verify the account rate currency, and only convert using a fresh, documented USD/INR rate (never 1:1).
- Panel states partial/canceled refunds are returned to **supplier wallet credit**, not original card. Do not advertise cash refunds based on this policy.
- Example service in owner's screenshot: 10,000 quantity, ₹3,301.965 charge, average 56h41m — not an expedited service. Do not advertise faster delivery unless substantiated by the exact service's own history.

## Steps to enable, in order
1. From the logged-in SMMXPERT **Account / API** area, generate a key. Do **not** paste or email the key. Save it securely using Vercel's encrypted production environment secret entry or a separate preview/test environment initially. Use `LITIX_TRIAL_SMMXPERT_API_KEY` for isolated read-only tests; eventually use `LITIX_SMMXPERT_API_KEY` for a separately approved production deployment.
2. Read `services` and `balance` with the existing `src/lib/supplierTrialReadOnly.mjs`. Confirm response time, actual wallet currency and good-looking service entries. Do not make purchases in the preflight.
3. Determine whether the prices returned by the supplier API are denominated in INR or USD for this account (confirm vendor documentation or support). If INR, obtain a verifiable and fresh currency conversion service before calculating Litix USD customer prices.
4. Explicitly approve matching supplier IDs for each public Litix category, prioritizing USA Followers/Likes, then regular services. Verify `Default` fields, link formats, min/max quantity, current start-time estimate, cancel/refill flags and quality. The provider service IDs must never be confused with Boostero's IDs; use a supplier namespace in all new records.
5. Implement and test a **new SMMXPERT ledger, per-order atomic claim, supplier response audit, unknown-outcome freeze, payment-gateway reconciliation, and independent tracking updates**. Existing Boostero dispatch/cron must remain available for old orders.
6. Keep PayKings, Bluevine, Auth0, Resend, Litix AI, Custom Likes (up to 5 child orders), package prices and marketing design untouched.
7. Run verified zero-charge integration checks, a separately authorized small paid/credit test, verify SMMXPERT status through actual delivery, confirm wallet settlement, partial/canceled credit and customer receipt. Measure real supplier latency for representative services; do not equate self-advertised API speed with likes/followers delivery.
8. Roll out only an approved subset of SMMXPERT services to new purchases, with an immediate switch-off plan that **does not resubmit unknown/failed orders**.

## Readiness signals
`smmxpertActivationBlockers` and `smmxpertDraftQuote` in `src/lib/smmxpertMigrationQuote.mjs` implement fail-closed checks for enabled service IDs, supported types, quantity bounds, existing Litix retail floors/60% markup, and account currency.
These are **dormant preflight code**, not checkout code.

## Existing blockers
- No live SMMXPERT API key in Litix environment.
- Account-specific `balance.currency` and service quote currency not independently verified.
- Service IDs, true live speed, rates and 5-post supplier outcome not trialed.
- Production SMMXPERT checkout, ledger, status and billing integration unimplemented.
- Old Boostero paid orders and multi-post cancellations still need independent reconciliation.

**Do not set any `LITIX_NEW_ORDER_SUPPLIER=smmxpert` flag or disable Boostero until above gates are green.** An incomplete switch would strand customers.
