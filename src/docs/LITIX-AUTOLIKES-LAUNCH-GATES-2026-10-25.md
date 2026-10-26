# Litix Auth0 & AutoLikes release gates — October 25, 2026

**Current live site:** `https://www.litix.net`; READY deployment `dpl_83o2jhgBu2KjY3dB4XkNec98Njju`, commit `067e949ab29c3753ec256e70dccb64925eeb6057`. Do not overwrite its PayKings Collect.js flow or paid orders.

**Development branch:** `feature/litix-autolikes-campaign-drafts-20261025`, PR #36, based on in-progress Auth0 PR #34. Feature Preview has an isolated Neon QA connection and a separately generated Auth0 session secret. AutoLikes activation and subscription charging are disabled by default.

## Auth0 registration (user/provider action required)
Create or select an Auth0 **Regular Web Application** and register exactly:

- Allowed Callback URLs: `https://litixfinallogocorrectedvercelready-git-9f1a7c-litgnosisllc-9049.vercel.app/auth/callback`
- Allowed Logout URLs: `https://litixfinallogocorrectedvercelready-git-9f1a7c-litgnosisllc-9049.vercel.app`
- Allowed Web Origins: `https://litixfinallogocorrectedvercelready-git-9f1a7c-litgnosisllc-9049.vercel.app`

The Auth0 SDK v4 routes live at `/auth/login`, `/auth/logout`, `/auth/callback`; **not** `/api/auth/*`.

In Vercel project `litix_final_logo_corrected_vercel_ready`, Git-branch-scoped **Preview only** environment, store the tenant-issued `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` as appropriate environment variables; never commit or paste them into chat. `AUTH0_SECRET` was securely generated and saved under the branch already, and `APP_BASE_URL` points at the stable Preview alias above. Once Auth0 app allowlists and credentials are present, set `LITIX_CUSTOMER_LOGIN_ENABLED=true` **Preview only**, redeploy and test signup, login, callback, profile, session persistence, account visibility, wrong-user denial, and logout before any production release.

## Real recurring payments
PayKings/NMI recurring subscriptions **are not merchant-verified**. Keep AutoLikes purchase UI disabled. A billing launch must first confirm merchant recurring-module support and provide dedicated Preview/test keys for `NMI_TEST_SECURITY_KEY`, `NMI_TEST_GATEWAY_URL`, `NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY`. The NMI gateway supports recurring plans in documentation; this does not prove this merchant can use them.

An approved implementation must have customer authorization/consent, tokenized recurring payment instruments (never raw card details), signed provider lifecycle evidence, an append-only event ledger, idempotent provider event replay, monthly renewal and cancellation tests, and fail-closed recovery from ambiguous gateway responses.

## New posts & delivery
SMMGLOB's service/order/status API is **not a verified source of user post discovery**. Do not simulate public Instagram/TikTok API connectivity or fabricate an average delivery speed. A production poller must use a permissioned source of new posts and validate the exact account ownership/consent and media ID before placing any order. A five-minute scan cadence requires permissioned source polling and a supported Vercel scheduling plan.

`LITIX_AUTOLIKES_EVENT_INGEST_ENABLED=false` is explicitly configured for the development branch. Its event-ingestion endpoint also requires an independent HMAC event signature, the cron secret, a consented watcher, a matching campaign/owner with current `ACTIVE_PAID` subscription, and independently verified successful payment evidence. Event submission only queues a record; it **never** submits supplier orders.

Staging-only migration `src/db/migrations/20261023-platform-foundation.sql` and `src/db/migrations/20261025-autolikes-billing-guardrails.sql` applied to Neon `br-patient-dust-awdnby4p`. These create subscription evidence, duplicate-resistant delivery claims, verified billing-event fingerprints and row-level security. **No production schema mutation has been made.**

## Verified tests / rollout policy
- 113/113 automated tests passed. Clean `npm ci` and `next build` succeeded.
- Neon staging campaign draft create, idempotent repeated insert, pause, resume and cancel SQL passed; no real charges or supplier orders were made.
- Staging schema confirms RLS on 5 sensitive tables and uniqueness indices on subscription events and post/delivery claims.
- Public Preview account APIs return 503 while Auth0 tenant credentials are missing; no anonymous customer access.
- Production stays on the recorded READY rollback commit.

**Do not merge or deploy PR #34/#36 to production until actual Auth0, NMI test renewal/cancellation and signed source-event / exactly-once supplier integration tests pass.**
