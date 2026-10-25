# LITIX DEFAULT RECOVERY RECORD — OCTOBER 25, 2026

**Current safe default: production source commit `067e949ab29c3753ec256e70dccb64925eeb6057`.**

This record is an additional permanent, sanitized backup of the decisions and release state reached in the owner's working conversation. It is a summary, not a verbatim chat export. No keys, payment card information, customer database data or private tracking secrets are included.

## Source ZIP links (full GitHub archives)
- **Verified working production:** https://github.com/LitGnosis/Litix/archive/067e949ab29c3753ec256e70dccb64925eeb6057.zip
- **Customer-account release candidate (not on production):** https://github.com/LitGnosis/Litix/archive/dbda301f3b5c6e7a5d9f20688907e3970946809d.zip
- **AutoLikes experimental source (not on production):** https://github.com/LitGnosis/Litix/archive/e790d36a454b25b1f8dfc32bf26f329696fba5e5.zip

## Protected branches
- `backup/litix-verified-live-paykings-2026-10-25`: 067e949ab29c3753ec256e70dccb64925eeb6057
- `backup/litix-customer-release-candidate-2026-10-25`: dbda301f3b5c6e7a5d9f20688907e3970946809d
- `backup/litix-autolikes-preview-experimental-2026-10-25`: e790d36a454b25b1f8dfc32bf26f329696fba5e5
- This docs branch: source based on 067e949ab29c3753ec256e70dccb64925eeb6057 plus this recovery record.

## Working production verified
- https://www.litix.net is live and READY on Vercel deployment `dpl_83o2jhgBu2KjY3dB4XkNec98Njju`.
- Vercel team `team_Z3J6KfMyhHqTJqGHuWRgZbIc`, project `prj_ATrABQBmZbBlw3mpz04Pvnu7AxXv`.
- PayKings/NMI Collect.js checkout accepted an actual owner-initiated $4.20 transaction for 600 Instagram followers; checkout confirmation and guest private tracking worked.
- Resend delivered actual payment-confirmation and private tracking-link emails; buyer displayed successful receipts.
- SMMGLOB supplier order 1691102 accepted, reported Processing; new follower notifications subsequently appeared. Zero supplier-reported remaining is not independent proof of final completion.
- Hourly status watch for meaningful supplier terminal status was set up, with no duplicate charges or orders.

## Candidate only — not production
- Draft customer-only PR #37: https://github.com/LitGnosis/Litix/pull/37, source dbda301f3b5c6e7a5d9f20688907e3970946809d, READY Vercel Preview `dpl_8tKgtKEAsMqh4ZEEnDjgKzFeaHFu`; passed 92 Node tests and a Next.js build.
- Its Auth0 customer dashboard and authenticated own-order tracking are separated from draft AutoLikes recurring billing.
- Draft AutoLikes PR #36: https://github.com/LitGnosis/Litix/pull/36; unfinished NMI recurring and supplier automation remain disabled.

## IMPORTANT unresolved production Auth0 gate
An Auth0 authorization request for the verified Preview callback was accepted with a login redirect, but requests for `https://www.litix.net/auth/callback` and `https://litix.net/auth/callback` returned HTTP 403. The app needs these production Allowed Callback URLs, plus `https://www.litix.net` and `https://litix.net` Allowed Logout URLs and Allowed Web Origins in Auth0. Never enable production Auth0 until allowlist, production secrets and verified-email session tests pass. Rotate the previously disclosed Client Secret. Do not break PayKings checkout by prematurely promoting.

## Previous historical restore baseline
The earlier stable checkout/email baseline SHA `7fb9d268d554f2feb3e09a8d124f857f2da1cb57` remains available via existing historical backup branch and earlier ChatGPT Library kit. It is superseded as the **default**, not deleted.

## Recovery
Restore the pinned full source ZIP from GitHub, preserve the existing Vercel production env vars and Neon production database, run tests/build and safely stage before promotion. Never replay payments or supplier orders, never force push, and never publish credentials.

## Chat/ZIP record
A separate `Litix-NEW-DEFAULT-VERIFIED-LIVE-2026-10-25-RESTORE-KIT.zip` was created in the ChatGPT working artifacts with a detailed reconstructed conversation summary, historical kit, validation notes, scripts and private evidence screenshots. Source archives are pinned externally above and are not themselves embedded in that lightweight recovery kit.

## Neon production database recovery (additional, non-destructive backups)
- Neon project: `fancy-wave-75069167`.
- Live production branch preserved unchanged: `br-long-term-awmdp29b`.
- Verified copy-on-write backup branch READY, with NO compute: `br-small-sea-awybamqq`, name `backup-litix-verified-live-2026-10-25`, parent `br-long-term-awmdp29b`, parent timestamp `2026-10-25T22:04:33Z`.
- Manual snapshot: `snap-fragrant-hat-awyjlty1`, named "Litix verified live checkout and orders 2026-10-25", created `2026-10-25T22:06:36Z`.
- This is a database backup in the SAME Neon project; maintain independent exports/longer-term retention separately if required. Never restore over production automatically, and do not expose copied customer records.
