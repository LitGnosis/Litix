# Litix Digital Products — Build Plan

This document defines the implementation gates for turning the current storefront and source templates into a real paid product line. It is intentionally separate from the existing social-growth order and supplier flow.

## Product readiness

- [x] Storefront concept page and responsive styling.
- [x] First drafts of all three product kits.
- [x] Spreadsheet-ready source templates.
- [x] Draft separate order / entitlement database schema.
- [x] Add gated PayKings/NMI tokenized checkout API with server-side product pricing and idempotency.
- [x] Add protected ZIP asset storage/upload and time-limited download entitlements.
- [x] Add guarded admin revocation for verified refunds and chargebacks.
- [x] Add a checkout readiness endpoint and gated checkout UI; sales stay disabled until assets and configuration are ready.
- [x] Early-access signup API, confirmation email, and token-based unsubscribe endpoint (disabled until explicitly enabled).
- [ ] Editorial review, consistency pass, and final branded layouts.
- [ ] Generate final PDF / spreadsheet packages and inspect every file.
- [ ] Decide final prices, customer license, terms, support contact, and refund policy.
- [ ] Add clear sample previews that do not expose full paid files.

## Checkout and fulfillment requirements

1. Use a server-side allowlist for product IDs and prices. Never trust an amount, product name, or file path supplied by the browser.
2. Use the existing approved PayKings/NMI tokenization flow only after confirming the correct private gateway credential and environment variable names. The public Collect.js key must never be used as a payment secret.
3. Accept payment tokens only; never accept raw card number, expiration, or CVV fields on Litix servers.
4. Do not make a live charge while implementing. Build with explicit sandbox/test configuration and fail closed when it is missing.
5. Use idempotency keys and persist the order before submitting payment. A timeout or ambiguous response must become review, not a new automatic charge.
6. Mark paid only after an authoritative gateway approval and transaction ID are validated.
7. Grant an entitlement only to a paid order. Store only a hash of the high-entropy download token.
8. Keep binaries outside the public web root. Use authenticated access or short-lived signed URLs; never use a public repository/raw URL for paid files.
9. Enforce expiration and download limits on the server, not just in the interface.
10. Record payment, access, refund, and revocation events without logging card data, payment tokens, or gateway secrets.
11. Support refunds/chargebacks by revoking access and keeping a minimal audit trail.
12. Provide order receipt, download instructions, and a clear recovery/support path.
13. Test declined payments, duplicate submissions, timeouts, webhook retries, expired links, refund revocation, and mobile usability.

## Required configuration before testing or enabling sales

The new commerce routes deliberately fail closed. They require a dedicated LITIX_DIGITAL_DATABASE_URL and a reviewed application of the SQL migration. Private bundles are uploaded through the protected asset endpoint only after LITIX_DIGITAL_ASSET_UPLOAD_ENABLED is explicitly set to true and LITIX_DIGITAL_ASSET_ADMIN_TOKEN is set. The upload endpoint accepts ZIP bundles up to 8 MB and stores them in the dedicated digital-products database, not in the public web root.

Checkout remains disabled unless LITIX_DIGITAL_SALES_ENABLED is true. Gateway configuration uses LITIX_DIGITAL_GATEWAY_MODE=TEST with LITIX_DIGITAL_TEST_GATEWAY_URL and LITIX_DIGITAL_TEST_GATEWAY_KEY, or LITIX_DIGITAL_GATEWAY_MODE=PRODUCTION with LITIX_DIGITAL_PRODUCTION_GATEWAY_URL and LITIX_DIGITAL_PRODUCTION_GATEWAY_KEY. The production gateway host is restricted to paykings.transactiongateway.com. Never reuse the public Collect.js key as a private gateway credential. The test gateway must be a dedicated non-production HTTPS endpoint.

Paid download links are random bearer tokens stored only as SHA-256 hashes. They expire after 30 days and permit at most five downloads. The product bundle must exist before a charge is attempted. Payment timeouts and uncertain responses enter review state and must never trigger automatic repeat charges.

## Waitlist configuration

The signup route fails closed unless LITIX_DIGITAL_WAITLIST_ENABLED is set to true and LITIX_DIGITAL_DATABASE_URL, RESEND_API_KEY, EMAIL_FROM, and SITE_URL are correctly configured. Apply the waitlist schema only to a dedicated digital-products database. Test confirmation delivery and unsubscribe behavior before enabling signup publicly.

## Database

The proposed migration at src/db/migrations/20261029_digital_products.sql must be reviewed against the actual connected database and naming conventions before applying. Do not execute schema changes as a side effect of a request.

## Existing commerce boundaries

- Do not change the current social-growth checkout in this feature.
- Do not dispatch digital product purchases to any social-growth supplier.
- Do not silently switch or reuse the existing supplier integration; SmmGlob is the intended supplier for social-growth fulfillment work.
- Do not claim the digital store is launched until checkout, entitlement delivery, refund/revocation, and end-to-end tests are verified.
