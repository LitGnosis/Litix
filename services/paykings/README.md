# NMI checkout bridge — staged change, not production activation

This is the actual Express payment service recovered from its production deployment source, not a speculative Next.js replacement. The storefront remains untouched. Existing signed webhook and Query API settlement verification remain in place. Do not deploy the repository root to this project.

## Deploy safely

1. Review this change against the live bridge, including build-time hotfixes. The live project's build command evaluates an environment-supplied hotfix; this source intentionally does not execute that opaque script. Confirm any required changes from it before replacing production.
2. Apply `migrations/001-nmi-ledger.sql` using the Neon SQL editor on an isolated staging branch, alongside the existing supplier and PayKings tables. This session has not executed SQL. No schema or row was changed in Neon.
3. Configure `LITIX_AUDIT_SIGNING_SECRET` (at least 32 random bytes), `LITIX_AUDIT_KEY_ID`, existing NMI/bridge keys, and staging DATABASE_URL in protected environment inputs. There is no default signing secret. Do not send values in chat.
4. Keep `LITIX_PAYKINGS_CHARGES_ACTIVE=false` and `LITIX_PAYKINGS_ENABLED=false` for build-only previews. An active integration needs isolated staging setup and an explicit sandbox validation plan; the inherited readiness gate intentionally refuses test-mode processing.
5. Redirect is the default path (`LITIX_NMI_CHECKOUT_PATH=redirect`). It sends XML (`text/xml`) to `/api/v2/three-step`; it is not the Direct Post form protocol. Success requires XML `result=1`, `result-code=100`, a transaction ID and a trusted HTTPS `form-url`. Step 1 is INITIALIZED, never paid.
6. Optional Collect.js: verify the public key's Tokenization permission in the merchant gateway **Settings > Security Keys**. Only then configure `LITIX_NMI_CHECKOUT_PATH=collect` and `LITIX_NMI_TOKENIZATION_VERIFIED=true` in isolated staging. The backend accepts `{orderId,payment_token}` over the existing server-authenticated bridge API and posts `type=auth` to `/api/transact.php`. This is authorization only, NOT settlement or capture. A new inline frontend plus an explicit capture policy are still required before storefront adoption. Never activate both paths for one order.
7. Run sandbox integration tests, including Step 3, Query API reconciliation, restart after timeout, audit write failure, actual PostgreSQL contention, and key-rotation decrypt/verify checks. The automated tests here use mocked database and network adapters; they are not end-to-end payment proof.
8. Configure project root `services/paykings` only after reviewing other projects linked to this repository; do not auto-merge or promote this PR blindly.

## Replay and evidence policy

The existing server-generated supplier order ID is the atomic ledger key. Pricing and email are loaded under a database row lock, not accepted from the client. Fingerprints bind order, mode, amount, currency and a hash of the token. The committed claim is never removed on network or persistence failure. Pending/unknown orders require operator reconciliation; a crashed or ambiguous call cannot be retried automatically. Successful identical calls return the cached response. Do not clear claims to retry a charge.

A successful audit row and cached response commit in the same PostgreSQL transaction before success is returned. HMAC-SHA256 is symmetric authentication, not an asymmetric signature. The JSON manifest binds the request hash, provider reference, amount, currency, status, key ID and timestamp. Audit signing keys must be retained by key ID across rotations. Failed responses are encrypted with AES-256-GCM at rest (key derived from the protected audit secret) rather than printed to console; raw gateway payloads can contain sensitive fields. Diagnostic storage is limited to 100 KB. Restrict audit table access and establish retention/deletion controls before activation.

NMI documentation: https://docs.nmi.com/docs/payment-code-examples and https://docs.nmi.com/reference/transactions-processing

## Checks

`npm ci && npm test && npm run build`
