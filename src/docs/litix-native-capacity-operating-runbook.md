# Litix Native: independent supplier capacity and global publisher network

## What is now real
- Free Litix-owned digital-file generation: original caption kits, link-page exports and seven-day campaign plans.
- An independent first-party supplier-discovery API; partner trial submissions remain disabled until the ledger, tenant credentials, rate limits and rollout are reviewed.
- A staged separate 30-day Pro product and NMI settlement-verified digital delivery engine; live native paid checkout remains disabled.
- A direct, consent-based application flow for real publishers and creators, delivered through the existing reviewed Litix partner email pipeline.
- A read-only, public supplier capability API under `/api/native/v1/capabilities` and a readiness page under `/native/supply`.

## What is not real yet
- Native fulfillment of a legacy Boostero follower, like, view, comment, repost, or subscription order.
- Automatic activation of any submitted publisher application, contract, inventory, payment, creator payout, or result guarantee.
- A live self-service advertiser booking, live wholesaler wallet, or settled native paid contract.
- A global network of signed, screened publishers. Those must be recruited and verified individually.

## Verification workflow for actual supplier inventory
1. Receive a creator/publisher proposal on `/publishers#apply` through Litix Resend; send only an acknowledgment, no product or order.
2. Human staff verifies identity, a real portfolio, audience geography, licensing, sponsorship disclosure rules and relevant platform policies.
3. Sign a genuine commercial agreement identifying the work, exclusive rights, measurable proof, capacity slots, expected turnaround, cancellation rules, media spend, costs and creator payout.
4. Record the audited offer in **server-only** `LITIX_NATIVE_VERIFIED_CAPACITY_JSON` with signed contract identifier and dated evidence. The format is validated by `verifyNativeSupplyOffer`, and private identifiers/rates never leave the backend.
5. Keep `LITIX_NATIVE_INVENTORY_VISIBILITY_ENABLED` off until the audit passes. Even eligible public proposals have `bookingEnabled:false` because booking/settlement/reservation accounting is not ready. No offer can be sold through this API today.
6. Before enabling booking, implement an atomic capacity slot reservation, authoritative merchant settlement, signed work order, delivery evidence, customer approval, recovery, refunds and creator payout ledger. Review race conditions before any release.
7. Only after customer support terms and real unit economics are approved should selected offers become customer-purchasable. Do not reroute already-paid Boostero orders.

## Capacity and margin requirements
Each proposal must have a reviewed identity, signed/active agreement, rights permission, disclosure and platform compliance confirmations, verified region, concrete remaining slots, 1–180 day lead time and an explicitly profitable price after creator fees, media budget, support reserves and estimated gateway fees. An unapproved or expired offer fails closed. The public API omits confidential partner details and cost fields.

## Supplier independence does not mean synthetic metric creation
Official Instagram, TikTok, YouTube and other platform systems do not provide an API to create authentic likes or followers. Fake traffic, engagement exchanges and coerced engagement violate platform policies. Litix can instead supply authentic creative work and permissioned, transparently disclosed placements and authorized advertisements, measuring actual reach without guarantees.

## Source boundaries
The live legacy SMM catalog and Boostero order, payment, supplier and tracking logic remain unchanged. This PR adds only the independent information and supplier-intake layer. Its actions never contact a third-party supplier or take payment.
For questions about actual coverage, use `/api/native/v1/capabilities`; do not claim all storefront services are native until verified order outcomes and backed inventory establish that fact.