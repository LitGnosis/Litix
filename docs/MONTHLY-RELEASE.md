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

## Component evidence update

| Component | Status | Evidence / remaining requirement |
|---|---|---|
| Auth0 server-session/account source | IMPLEMENTED — TEST PENDING | Verified-email and subject-isolation local tests; real login/callback/recovery/session-expiry not exercised. Requires existing Auth0 application callback/logout settings and provider verification/recovery configuration. |
| Isolated local migrations/repository | VERIFIED WORKING | PGlite integration executes migrations, duplicate handling, customer isolation and daily-post claims. Does not establish remote Neon results. |
| Remote Neon migration | NOT IMPLEMENTED | Isolated resource connected to Preview with unique prefix; no remote SQL executed. |
| Recurring creation/cancellation | IMPLEMENTED — TEST PENDING | Adapter and disabled route tests only. Repaired routes to require NMI_GATEWAY_MODE=TEST, dedicated test key and exact sandbox.nmi.com transact endpoint; no fallback to live keys. |
| Hosted-card monthly purchase UI | NOT IMPLEMENTED | Existing one-time hosted fields are not represented as a completed monthly checkout. |
| Settlement application/query adapters | IMPLEMENTED — TEST PENDING | Synthetic XML matching and SQL replay tests only. Query adapter is not a scheduled worker and has not queried merchant data. |
| Scheduled refund/dispute reconciliation | NOT IMPLEMENTED | Requires event history and verified merchant transaction outcomes; no entitlement changes inferred from build success. |
| Customer management email adapter | IMPLEMENTED — TEST PENDING | Mocked HTTP only. Authorized recipient not supplied; sender authentication and delivery not tested. |
| Full transactional email lifecycle/outbox | NOT IMPLEMENTED | Welcome/receipt/failure/fulfillment notifications are not all wired. |
| Meta/TikTok account linking/post discovery | BLOCKED BY EXTERNAL ACCESS | No approved app credentials, OAuth scopes, test users or ownership-verified accounts provided. OAuth callback/refresh adapters also remain unimplemented. No scraping workaround. |
| Supplier automated fulfillment | NOT IMPLEMENTED | Historical errors identified, no successful authenticated supplier request. Provider service/price/contract and scanner integration unverified. |
| Existing one-time checkout regressions | VERIFIED WORKING | Mocked local payment and Collect.js lifecycle tests; no real purchase performed. |

This is a partial implementation. Neither tests nor a Ready deployment establish customer readiness. The latest sandbox-only repair changes source, not any live environment or production gateway. All external integration gates remain off.

## Deployment verification — sandbox safety repair

Published code commit 0bac61ed416d5f120416a8a9e4ea7b98f67f7331: GitHub status `Vercel – litix_final_logo_corrected_vercel_ready` is FAILURE with target https://vercel.link/env-vars-limit. The target project deployment list still ends at 357c013; no new main-project deployment was created for the repaired source. Therefore there is no verified new target-project working preview. Other linked projects reporting success do not verify this project's environment or integrations. Local 84 tests and production build passed. Scoped Preview variable cleanup must precede retry; do not delete existing checkout/auth/provider credentials indiscriminately. Neon connection added 16 prefixed variables and may contribute, but causality has not been established.

## Preview size repair

Vercel's last rejection measured 64.1KB effective environment (rounded provider output). Removed Preview-only LITIX_FEATURED_COMPONENT_SOURCE: 6,217 UTF-8 value bytes + 31 name bytes. No tracked application code, computed environment lookup or active project build/install command consumed it. No source migration was needed: current catalog/theme functionality is already version controlled. Other credentials and Production were unchanged. An attempted target-only edit to shared LITIX_MULTI_CATALOG_ROUTE_SOURCE was denied under nonproduction access; it remains unchanged. That variable is not claimed removed.

Exact commit 7bf2ed65119d95c83a11ee242ea268046205600f was accepted for deployment dpl_FwfYKA86MkZzow1MVyyX9VbRtw74 at https://litixfinallogocorrectedvercelready-7cbbgjvie-litgnosisllc-9049.vercel.app. Build outcome must be inspected separately. Estimated final runtime payload is approximately 58KB, based on Vercel's rounded rejection minus 6,248 bytes; exact final bytes are not established. Target below 56KB is not reached. CLI lists encrypted ciphertext, so summing those lengths would misreport runtime size. A reusable redacted listing audit is in src/scripts/audit-env-bytes.mjs; it explicitly distinguishes plaintext bytes from stored encrypted representations. No decrypted environment or payload source was committed.

Preview repair verified: deployment dpl_FwfYKA86MkZzow1MVyyX9VbRtw74 reached READY for exact code commit 7bf2ed65119d95c83a11ee242ea268046205600f. URL: https://litixfinallogocorrectedvercelready-7cbbgjvie-litgnosisllc-9049.vercel.app . Production remains dpl_iaihLawqQM81nb9gXiApjgAX1gZa. Sandbox cannot request deployment hosts, so remote HTTP/auth/mobile smoke tests are not claimed. The size rejection is resolved for this commit, but the below-56KB headroom target is not verified/reached and customer subscriptions remain disabled. Documentation/audit-tool follow-up commits do not replace that tested code identity.
