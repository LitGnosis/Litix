# Exact bundle settlement preparation (not activated)

The existing custom checkout creates one supplier order for one service and target.
It cannot safely be reused as a bundle purchase without distinguishing a payment
carrier from a fulfillable supplier order. Do not insert a synthetic bundle as an
ordinary supplier service: the reconciliation worker would try to submit it.

This change prepares atomic bundle-credit activation after verified settlement.
It requires the matching purchase, paid storefront order and settled PayKings
ledger to agree on amount, USD currency, customer, email and transaction. The
advertised quantities are snapshotted at purchase rather than reconstructed from
a catalog that can change after payment. SQL locks the purchase and evidence,
creates all balances in the same transaction, and permits one activation only.
A unique settlement transaction prevents the same payment funding two bundles.

## Not yet implemented or verified

- Creation of product payment orders and safe separation from supplier fulfillment.
- Bridge support for product purchases, and payment-to-product reconciliation.
- Production migration deployment and role privileges. The SQL function is
  security-invoker and revoked from PUBLIC; explicitly grant only the intended
  application role after reviewing the actual deployment role.
- Verified delivery capacity and pricing for every advertised bundle metric.
- Instagram discovery, prepaid likes-plus-video-views fulfillment, 30-day term,
  daily cap and retry-safe automation. Existing wallet-per-service scheduler is
  not the advertised Instagram prepaid package.
- Live gateway, real supplier fulfillment or production database validation.

Do not wire activation into cron or enable product checkout until the above is
implemented and tested on an isolated database. No production data is changed by
this code publication. Readiness remains false for card-product activation.

## Checks

`node --test tests/*.test.mjs` covers settlement mismatches and exact credits.
`tests/database/package-activation.mjs` was run with an isolated PGlite instance:
additive SQL, unpaid rejection, six exact launch balances and replay rejection.
To reproduce, install `@electric-sql/pglite` separately and set `PGLITE_MODULE` to
that installation's module path, then run the script with Node. This does not
prove live Neon permissions, real gateway verification or deployment concurrency.
