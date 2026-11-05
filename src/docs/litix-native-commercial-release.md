# Litix Native Commercial Supplier — controlled rollout

## Current release status
This source adds a distinct first-party 30-day creative campaign product and a separate backend for server-calculated quotes, one-time NMI card-token sales, locked orders, settlement reconciliation, private file delivery and a Resend delivery outbox.
**Important:** Code deployment does not enable purchases. Native paid checkout is disabled unless all explicit gates pass. No Boostero, JoySMM, SMMGLOB or other supplier calls are part of this code.

## Why these safeguards exist
NMI identifies an approved sale separately from a settled transaction. The Native engine retains an approved order in APPROVED_UNVERIFIED and releases the file only when NMI Classic Query returns the exact matching transaction, order ID, USD amount and condition=complete. The gateway defines complete as settled.
Every quote is derived from a server-owned price configuration and documented direct cost/support reserves. The server rejects offers below a conservative estimated 25% gross margin after gateway fees.
A durable unique request ID is inserted before any NMI sale request. Repeated submissions are rejected rather than charged again. Unknown gateway outcomes move to REVIEW; they are never automatically resubmitted.
The order token is an HMAC derived from a server-only signing secret, and the URL unlocks only the matching settled order. A one-event-at-a-time outbox attempts the Resend email with an idempotency key, putting ambiguous results in REVIEW.

## Required production configuration (server only)
- LITIX_NATIVE_PAID_ENABLED=false (do not enable before final review)
- LITIX_NATIVE_DATABASE_URL=<separate approved Neon connection to the migrated Native ledger>
- LITIX_NATIVE_ORDER_SECRET=<random secret of at least 32 characters generated in an authorized secret manager>
- LITIX_NATIVE_PRICES_JSON=<owner-approved JSON mapping premium SKU to priceCents, costCents, supportReserveCents>
- NMI_SECURITY_KEY=<existing authorized gateway key; never print or duplicate into GitHub>
- RESEND_API_KEY=<existing Litix transactional email key>
The only premium SKU staged is litix-native-30day-campaign-pro. The three existing free SKUs remain free forever unless separately redesigned and approved.

## Required go-live checklist
1. Verify a restore-ready encrypted backup and run isolated PostgreSQL migration tests, then an approved additive Neon migration without touching legacy tables.
2. Verify gateway settlement report access in the merchant account, without charging a live card. Test approval, pending-settlement, settlement, decline, timeout and refund/chargeback scenarios using provider test credentials.
3. Validate price, transaction fees, operational support costs, refunds, taxes, content ownership, acceptable-use terms and delivery promises. Confirm commercial approval for premium pricing.
4. Complete final browser hosted-fields UI integration for Collect.js in a sandbox with no actual charge. This backend does not activate a public payment form merely from a feature flag.
5. Add independent request rate limits, fraud/bot protections, production observability and retention/deletion for creator briefs.
6. Verify private download access, email idempotency, account recovery if a response is lost, and refunds/reversals. Do not auto-retry unknown NMI outcomes.
7. Separately approve explicit live feature rollout and verify a real authorized test purchase only when owner provides a test payment method and clear approval.

## Wholesale and genuine distribution
/wholesale accepts agency interest and explains that wholesale API order placement is restricted. Existing /api/native/v1/reseller remains free-trial/discovery only, disabled for writes until partner credentials and ledger migration.
/publishers invites opted-in creators and publishers to propose original content and disclosed placements. Those are proposals, not inventory sold to customers. Partner identity, rights, audience authenticity and campaign performance must be verified and contracted.

## Operations
Do not give customers fake receipt statuses. Review every unknown NMI payment outcome against the authoritative transaction report before issuing a new charge. Refunds/chargebacks should revoke download access in the ledger only after payment-provider verification and manual operator review.
Daily reliability reviews should separately report existing Boostero order health and Native quote/delivery readiness and never add their revenue as if it came from the same provider.