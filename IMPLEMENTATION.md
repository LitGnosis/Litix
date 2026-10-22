# Metallic storefront

Recovered the six input source files from the current production deployment (2026-10-22 00:47 UTC). Unlike older repair branches, this is the current catalog storefront. Main previously contained no app. The app root is `src`; deploy that directory, not repository root.

The added stylesheet supplies blue and yellow metallic surfaces, animated platinum accents, mobile layout, visible keyboard focus and reduced-motion support. It fixes missing styles for the current markup's checkout, tracking, message and footer classes. Checkout, catalog pricing and dispatch source are byte-for-byte unchanged. The Next.js version matches the current production install override (15.5.28).

This is NOT Auto-Boost activation. Current production source has no customer-account authentication, post scanner, or PayKings outbox consumer. Its checkout writes `litix_v2_orders` and immediately attempts supplier dispatch after an approved sale; it is not an outbox worker. Do not attach a guessed worker or replay historical payments. Need the actual outbox schema, verified-payment contract, account ownership mapping, supported scanner integration and dispatch deduplication/reconciliation contract before enabling automation. The older feature branches have different source and must not replace this storefront wholesale.

No bundles, prices, delivery rules or environment credentials are changed. No ZIPs are produced. No real charges or supplier orders were sent. Local tests check unchanged behavior source plus theme mounting/accessibility rules, not browser appearance or payment functionality.
