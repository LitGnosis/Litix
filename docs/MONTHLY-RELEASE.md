# Monthly subscription release checklist

## Implemented in preview source
- Auth0 v4 server session integration isolated to /auth, /account and /api/account; disabled by default. Existing workspace middleware and storefront are preserved.
- Verified-email requirement and server subject-scoped dashboard queries for subscriptions, payments, order links and fulfillment. Historic orders are never assigned on email match alone.
- Authenticated signup application endpoint using existing creation/repository/email adapters; disabled by default. Origin check and server-owned customer identity/price.
- Authenticated cancellation endpoint with origin/ownership checks and atomic dispatch claim. Pending/unknown gateway outcomes are not displayed as successful cancellation.
- Additive customer schema and atomic paid-period daily post-claim function, verified in local PGlite tests.
- Isolated Neon Free resource connected to Preview with LITIX_MONTHLY prefix; production DATABASE_URL untouched. Remote migrations have NOT been applied.

## Required before integration testing
1. Apply the four monthly/customer/post-claim migrations to the isolated Neon database through an approved migration run. Back up/review before any later production application.
2. Auth0: confirm Universal Login database connection allows signup and password recovery; configure verification email, approved Preview callback URL /auth/callback, logout URL and APP_BASE_URL. Configure these in Auth0 Dashboard → Applications → Applications → existing Litix application → Settings. Do not turn accounts on until callback/login/verification/recovery/logout are tested with two independent users.
3. Auth0 SDK requires React 19.1.2: React/react-dom patched from 19.1.0 without forcing incompatible peers. Build emits an SDK DPoP dynamic-dependency warning; verify deployed auth runtime before release.
4. Verify Resend sender/domain authentication and real delivery. Vercel integration list/inspect status conflict remains unresolved. Supply an authorized test recipient; no inbox has been selected or emailed. Do not send to a guessed recipient.
5. Persist/validate approved first-charge schedule. Connect recurring query evidence to that schedule and transaction replay worker. Current creation adapter accepts days 1–28; account signup endpoint remains disabled and has no hosted-card signup UI yet.
6. Merchant must confirm recurring permission and processor support. No sandbox credentials are configured. Latest user instruction prohibits real purchases/charges without explicit approval. Do not enable LITIX_MONTHLY_PURCHASE_ENABLED as a substitute for integration testing.
7. Add secure expired/lost-link recovery, customer-facing receipts and verified retry/reconciliation worker. Never retry unknown NMI creation or supplier add outcomes blindly.
8. Platform integrations require approved Meta/TikTok app, account connection/OAuth scopes and supported eligible-post API/webhook. No platform app credentials or approvals have been verified. Do not scrape or claim automatic discovery is live.
9. Verify eligible supplier IDs/types, wholesale costs, status/cancel contract and ownership mapping. Do not substitute unrelated backup keys or dispatch directly from a browser event.

## Tests and production release
- Run full automated suite, actual Neon migrations/constraint tests, two-user isolation, origin/CSRF tests, Auth0 verification/recovery/session tests, real authorized email delivery, sandbox NMI signup/renewal/decline/cancel/reconciliation and duplicate events.
- Verify the existing one-time checkout regression suite and live configuration without making purchases.
- Confirm plan price, posts/day timezone, renewal date, consent terms, cancellation and support escalation. Temporary $0.50 simulator tier is not public production retail pricing.
- Preview must be Ready and end-to-end verified. Review PR #28; no automatic merge or promotion.
- Obtain explicit approval for any controlled live test, exact amount and renewal terms; supplier dispatch stays off for billing tests.
- Only after integration evidence, explicit release approval, backups and rollback target: apply additive production migrations/config, deploy without alias switch, verify, then promote. Monitor verified billing/fulfillment and email failures.

No live subscription activation, transaction, email, supplier order, destructive migration or production promotion occurred during this work.
