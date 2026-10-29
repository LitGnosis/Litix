# Litix Digital Products

This route is a storefront concept at `/digital-products` for the first three proposed products:

- Creator Launch Kit
- Social Growth Toolkit
- Agency Starter Pack

## Release status

The landing page is intentionally **not a checkout**. Displayed prices are concepts only, and all calls to action point to an early-access section. No products are currently for sale and no downloads are delivered.

## Before enabling purchases

1. Create and review the actual editable/downloadable files for each kit.
2. Choose and approve final price, format, license, refund terms, and product owner.
3. Implement a server-side product allowlist and trusted price lookup; never accept a browser-submitted amount.
4. Integrate an approved payment provider using the existing, separately tested payment architecture without exposing gateway secrets.
5. Verify payment settlement server-side before granting download access.
6. Issue short-lived, unguessable download links or authenticated entitlements; do not expose a public bucket of paid files.
7. Add idempotency, purchase receipts, refund/revocation, delivery retry, and audit events.
8. Test end-to-end in isolated test mode, including mobile browsers and failed/ambiguous payment outcomes.
9. Keep the current social-growth checkout, supplier routing, customer orders, and production domain unchanged until the digital-product release is reviewed.

This page uses proposed pricing for design context only and must not be marketed as a live purchasable catalog until the above gates pass.
