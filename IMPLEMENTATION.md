# Metallic storefront

Recovered the six input source files from the current production deployment (2026-10-22 00:47 UTC). Unlike older repair branches, this is the current catalog storefront. Main previously contained no app. The app root is `src`; Vercel Root Directory must be `src` when deploying the repository.

The added stylesheet supplies blue and yellow metallic surfaces, animated platinum accents, mobile layout, visible keyboard focus and reduced-motion support. It fixes missing styles for the current markup's checkout, tracking, message and footer classes. Catalog pricing and dispatch behavior are preserved. Checkout now rejects missing or changed displayed totals before creating an order or charging a card. The Next.js version matches the current production install override (15.5.28).

This is NOT Auto-Boost activation. Current production source has no customer-account authentication, post scanner, or PayKings outbox consumer. Its checkout writes `litix_v2_orders` and immediately attempts supplier dispatch after an approved sale; it is not an outbox worker. Do not attach a guessed worker or replay historical payments. Need the actual outbox schema, verified-payment contract, account ownership mapping, supported scanner integration and dispatch deduplication/reconciliation contract before enabling automation. The older feature branches have different source and must not replace this storefront wholesale.

No bundles, prices, delivery rules or environment credentials are changed. No ZIPs are produced. No real charges or supplier orders were sent. Local tests cover theme mounting/accessibility and mocked checkout price confirmation, approval, decline, duplicate submissions, gateway uncertainty and supplier timeout. All external calls in checkout tests are intercepted; they do not verify real payment or delivery functionality.

Deployment repair: the main Vercel project now uses Root Directory `src`, `npm ci --no-audit --no-fund`, and `npm run build`. The earlier Next install override is unnecessary because Next is pinned in the lockfile. Merge the updated storefront PR to make this source available on main; publishing a deployment alone does not merge GitHub.

## Storefront resilience follow-up

Based on the currently promoted pricing/refill-duration-tiers source, not the stale main application. Adds compatible /api/catalog/v1 and /api/checkout/v1 wrappers, bounded browser loading, a 1.5-second read-only catalog timeout, per-instance refresh deduplication and bounded stale cache reuse. This is in-memory caching, not shared durable Edge caching; background refresh is best effort across function lifetimes. Payment/status supplier timeouts are unchanged.

Hosted fields mount only after a supported service, HTTP(S) public-looking URL, valid email and service-specific integer quantity are present and gateway configuration is ready. This is UI validation, not proof a URL is public/reachable. Existing server price and payment validation remain authoritative.

Growth plans request up to three available catalog recommendations, with explicit review-to-checkout at each service's minimum quantity. The planning horizon is not a supplier drip schedule. No multi-item charge, recurring dispatch, or reach/algorithm outcome is promised.

Deferred: alternate suppliers require verified API contracts and supplier-qualified service/order IDs through checkout and tracking; blindly substituting another provider's IDs would misroute paid orders. Passwordless account sync and /api/auth/v1 are not implemented: choose a verified email-delivery integration and configure it securely, then add expiring one-use verification tokens, secure sessions, ownership enforcement and migrations. Existing workspace text accurately says browser-only; no mock account or persistence success response was added.

Verification: 47 mocked local tests pass. No live supplier order or payment was submitted. Production remains unchanged until separately reviewed and promoted.
