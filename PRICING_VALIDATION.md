# Final wholesale pricing — Preview QA

Baseline: restored `fix/resilient-storefront` commit `cf5e33104f93b988f6111ba3b5dc1b680f0dda96`. Pricing policy adapted from `Litix_Complete_Pricing_Rules_8x_5x_2x.zip`.

## Implemented

- Shared policy for the storefront catalog, secondary catalog and authoritative checkout. Supplier `rate` is wholesale per 1,000; retail is never used as wholesale. Supplier IDs, descriptions, category classifications, eligibility restrictions and quantity limits are preserved.
- Under $1: at least 8x. $1 through under $20: at least 5x. At/above $20: ordinary retail exactly 2x, rounded up to cents. Existing higher ordinary retail below $20 is retained as instructed by the archive.
- Instagram/TikTok followers/views: $6–$15 per 1,000 except verified 365-day/lifetime refill. ZIP target ladder: none $6.99; 7d $7.49; 15d $7.99; 30d $8.99; 60d $10.49; 90d $11.99; 120d $12.99; 180d $13.99; 270d $14.49; 365d $18.99; lifetime $22.99. Raise targets when required by wholesale or comparable shorter coverage; exclude on cap conflict.
- Comparable supplier families use otherwise matching labels, targeting and quantity constraints. Longer guarantees must cost more. Ordinary services whose exact 2x requirement conflicts with that ordering are excluded, not silently overpriced.
- Unknown/nonpositive/nonfinite wholesale, ambiguous social refill terms, unverified premium claims and incompatible caps cannot authorize a new purchase.
- Checkout refreshes supplier wholesale without stale fallback before calculating the server total. Both the per-1,000 policy and the actual-quantity wholesale floor must hold. An incompatible quantity is rejected before any order insert, payment or dispatch; no silent increase over the advertised amount. Existing $1 order minimum and expected-total confirmation remain.

## Verified locally

`node --test tests/*.test.mjs`: 84 tests pass, including all uploaded reference tests against the actual shared module, all platform brackets, exact $1/$20 boundaries, all 11 refill tiers, family ordering/cap exclusions, quantity crossings, stale catalog/supplier failure, and mocked approval/decline/duplicate/uncertain-payment/supplier-failure paths.

Boundary examples (USD, same pricing unit): $0.50 -> at least $4; $1 -> at least $5; $3 -> at least $15; $19.99 -> at least $99.95; $20 -> $40; $25 -> $50. The discontinuity at $20 is intentional.

Exclusion fixtures (NOT a live supplier report): standard TikTok views at $3.01 wholesale cannot fit the $15 cap; social refill with no duration, 365-day/lifetime text without refill evidence, and conflicting duration claims are blocked. In a comparable family with a $15 no-refill item, shorter-than-365 refill variants cannot be priced strictly higher under the cap and are excluded. Ordinary exact-2x services below a shorter guarantee's price are excluded.

Next.js build passes with the repository's existing lint/type-check skipping settings and existing `/api/v2/bulk` re-export warnings. No lint/type-check pass is claimed.

Paid-order persistence, gateway capture, supplier dispatch and tracking implementation remain unchanged. No migrations, historical price updates, real payment requests or supplier orders were performed. Receipts, Auth0 and payment configuration were not changed.

## Production gate — unresolved

The ZIP contains rules, examples and code, not an actual supplier wholesale export. Live service counts, repriced totals and exact excluded supplier IDs cannot be certified from these fixtures. Sandbox networking cannot request deployment URLs or the supplier directly. Deployed catalog/readiness, supplier currency/unit/fees, hosted fields, browser/mobile behavior and a safe sandbox checkout must be checked before promotion. Do not infer deployment HTTP health from Ready build status. No production promotion or domain change is authorized by this report.
