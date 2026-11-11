# LITIX — customer identity, agency tenant authorization and subscriptions: SAFE DRAFT

Date: 2026-10-28

**No checkout, database, supplier, Auth0 configuration, storefront component or production behavior changed.** This isolated branch adds pure business-rule code and mocked tests only.

## Implemented now

- `src/lib/litixAccountAuthorization.mjs`: requires pre-verified Auth0 JWT signature, correct issuer, audience, token lifetime and namespaced subject. The returned in-memory principal is non-forgeable from plain JSON. Personal order read requires an explicit stored Auth0 subject mapping; email matching is prohibited. Agency read and management require a server-loaded, active and nonrevoked membership for the exact order's tenant. Admin role is insufficient across another agency tenant. There is no public HTTP route.
- `src/lib/litixSubscriptionPolicy.mjs`: requires confirmed supplier support for recurring service, approved merchant recurring billing, authenticated customer, explicit timestamped consent, supported cadence and >=$5 charge. Provides an immutable proposed lifecycle for checkout, verified payment, payment failure, cancel-at-period-end, expiration and opt-in resume. Rejects replayed payment event IDs. The module does not invoke payment gateway, send emails, write databases, or submit supplier orders and exposes `paymentEnabled:false` and `fulfillmentEnabled:false`.
- `src/tests/litix-customer-agency-subscription-foundation.test.mjs`: validates strict issuer/audience, no JWT impersonation, own-order access, two-tenant isolation, active membership, role separation, recurrence consent and idempotency. A CI job checks existing Boostero-only, checkout, bundle and owner email regression tests and Next.js build.

## Remaining release requirements

1. Verify a **current independent backup** of both `neondb` and `litixapi`, including successful restores. October 25 snapshot remains preserved. Cloudflare R2 private bucket and owner-held age key are not yet connected.
2. Integrate a real authenticated Auth0 middleware that cryptographically validates JWKS signatures, issuer, audience, expiration and proper server-side session handling. The new helper assumes middleware verification has happened; its Boolean `signatureVerified` input is NOT cryptographic verification and must NEVER be supplied by HTTP request JSON.
3. Obtain authoritative immutable customer `auth0_sub` mapping and database-backed tenant membership with strict row-level tenant isolation, audited writes and separate agency invitations. Make read/write routes fail closed, test a real denial by two independent authenticated accounts, and review privacy/retention obligations.
4. For subscriptions, verify PayKings/NMI specifically authorizes recurring billing and provider webhooks, obtain matching Boostero supplier recurring model (if any), have users independently accept recurring terms, implement audited idempotent recurring charge and renewal records, cancellation/self-service controls and receipts. Do not treat ordinary one-time services as subscriptions.
5. Add premium blue-metallic customer dashboard and agency UI only after authenticated data isolation and mobile E2E tests pass. The current files intentionally do not render customer data in browser or create any customer orders.
6. Separate permissions for owner/admin; never expose wholesale prices or supplier API keys to public users. Keep all bundles manually fulfilled and Boostero the only supplier for new orders.

**Implementation status:** core draft policy and test foundation only, not a functional customer dashboard, recurring biller or agency panel. No production or paid activation is authorized.
