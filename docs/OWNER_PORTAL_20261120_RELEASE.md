# Litix private owner wholesale portal — release record

This feature is isolated at `/owner`, `/owner/auth/*` and `/api/owner/portal`. It intentionally does not modify public checkout, PayKings, UI, pricing, Litix AI, bundles, AutoLikes or legacy supplier records.

## Security baseline

- Auth0 confidential web-app OIDC authorization-code + PKCE; server checks signed ID token, issuer, client audience, nonce, verified email and exact `sub`.
- Signed secure HttpOnly owner-session cookie and same-origin CSRF verification for mutations.
- Server-only supplier credentials; owner prices, balances and wallet orders never appear in public routes.
- Only owner can request supplier catalog or quote.
- Every real supplier `add` requires a fresh, server-signed short-lived quote, exact amount confirmation, UUID idempotency key and active database reservation.
- Exactly one pending/uncertain wallet order per supplier. An unknown network outcome is **never automatically retried**.
- Purchase submission is explicitly gated by `LITIX_OWNER_PURCHASES_ENABLED=true`, `VERCEL_ENV=production`, the maximum-order limit, owner auth and supplier key/flags. The default is disabled.
- For additional safety, only `Default` supplier items with HTTPS public social-target links are supported. Provider metadata does not establish guaranteed refills or delivery times.

## Required protected Vercel environment names (server-only)

| Variable | Purpose |
| --- | --- |
| `LITIX_OWNER_AUTH0_DOMAIN` | Auth0 tenant hostname, no scheme |
| `LITIX_OWNER_AUTH0_CLIENT_ID` | Auth0 confidential application client ID |
| `LITIX_OWNER_AUTH0_CLIENT_SECRET` | Auth0 confidential application secret |
| `LITIX_OWNER_AUTH0_SUB` | **Exact verified** authorized Auth0 user subject; mandatory |
| `LITIX_OWNER_SESSION_SECRET` | Independent random secret of at least 48 characters |
| `LITIX_OWNER_PORTAL_ORIGIN` | Exact site origin, e.g. `https://www.litix.net` |
| `LITIX_OWNER_DATABASE_URL` | Restricted Neon DB URL for isolated order ledger; `LITIX_V2_DATABASE_URL` fallback |
| `BOOSTERO_API_KEY` | Existing Boostero key (never copy to browser) |
| `LITIX_OWNER_BOOSTERO_ENABLED` | Enable owner-only Boostero supplier catalog after verification |
| `LITIX_OWNER_SMMGLOB_API_KEY` | SMMGLOB account key, new private owner-only integration |
| `LITIX_OWNER_SMMGLOB_ENABLED` | Enable owner-only SMMGLOB after independent verification |
| `LITIX_OWNER_MAX_ORDER_CENTS` | Server-side hard maximum dollar spend per purchase, in cents |
| `LITIX_OWNER_PURCHASES_ENABLED` | **Leave false** until all release gates pass |

Auth0 Allowed Callback URL: `https://www.litix.net/owner/auth/callback` (must match configured origin). Allowed Logout URL: `https://www.litix.net/owner`.

## Migration

The additive schema is `src/db/migrations/20261120-owner-portal.sql`. It creates a dedicated ledger, unique quote/idempotency indexes, and a one-active-per-wallet constraint. Deploy migration to the verified production Neon database before enabling purchases. Never change legacy customer or supplier records as a side effect.

## Release gates

1. Production domain must be proven linked to the intended Vercel project and GitHub main branch.
2. Auth0 login from both desktop and actual iPhone must produce the exact approved owner `sub`. Verify an unrelated Auth0 user is denied.
3. Both supplier API `services` and `balance` must return current account-specific USD values; never infer SMMGLOB activation from historical code.
4. Neon owner portal schema migration and no-charge, concurrent duplicate/CSRF tests must pass.
5. Build, HTTP /owner noindex, mobile form and signed session checks must pass.
6. Existing retail checkout, PayKings tokenization, order lookup and multi-post behavior must pass regression checks.
7. **No supplier test order is placed without an explicit confirmed order.** Only enable live purchases after every preceding gate passes.

## Blockers found 2026-11-20

- Production Neon `fancy-wave-75069167` default branch returned **402 quota exceeded** for read-only SQL.
- The connected Vercel team had many Litix-named projects, but none inspected advertised `litix.net` as a custom domain; no correct production deployment target was established.
- Neither an authorized Auth0 user subject nor its application's live credentials could be verified through the repo or inspected project configuration.
- Existing public SMMGLOB code is intentionally disabled; owner-only SMMGLOB credentials and account-specific wholesale balance have not been verified.

Do not promote this branch to production or flip the purchase flag while any blocker remains. Fail closed; do not publish secrets, test credentials or supplier price responses.
