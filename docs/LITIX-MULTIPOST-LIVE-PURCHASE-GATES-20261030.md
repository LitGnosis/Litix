# Litix visual multi-post Likes: release gates

This branch is based on actual successful production source commit 1c99ba3e6c78a7eb03f77af3f505a3a301e5c857, not stale main.

## What is coded
- Instagram + TikTok Likes can select 2–5 posts visually from a three-column public gallery, including exactly 3. Direct-link manual fallback remains.
- Per-post minimums, verified live Boostero Default Likes service, 60% markup, and the exact summed customer price are checked before the one NMI/PayKings card sale.
- The parent payment and child-order ledger are distinct. Each child has a durable one-way claim and its own Boostero status; ambiguous supplier timeouts never cause blind retries.
- Private tracking can display the status and remaining quantity of every selected post. Existing authenticated cron is extended to poll child statuses.
- Single-post checkout, bundles, AI, WhatsApp, and Resend are preserved.

## Required pre-release checks (NOT verified)
1. Set APIFY_TOKEN securely in Vercel; use a real authorized Apify account and approve Actor usage and spend. Never paste or commit secrets. Review scraping rights and provider terms.
2. Add distributed rate limiting and cost ceilings for public post lookups. Current per-instance throttle is not sufficient alone.
3. Verify independent backup and isolated restore of BOTH actual production Neon databases, and confirm deployment-to-database mapping.
4. Apply src/db/migrations/20261030-multipost-boostero-children.sql on a staging clone, then the reviewed production database in a controlled release. This has NOT been applied.
5. Verify valid live Boostero service mappings, $1 minimum per post and total, rate quote, wallet funds, and independent per-post supplier acceptance.
6. Run NMI-safe payment simulation, duplicate-click and timeout tests, failed supplier add and ambiguous-timeout tests, email and tracking tests, and browser checks (mobile Safari, desktop). No real charge has been performed in this work.
7. Only after all checks pass enable LITIX_POST_PICKER_ENABLED=true and LITIX_MULTIPOST_AUTO_FULFILL_ENABLED=true, deploy the reviewed source, and do a user-initiated real purchase.

Both flags are OFF by default. The current Vercel project has no APIFY_TOKEN; the connected Neon account does not expose the Vercel production database. No production merge, migration, credential write, charge, supplier order or production promotion was done.

## Regression checks
node --test tests/boostero-multi-post-ledger.test.mjs tests/social-multi-post-live-checkout.test.mjs tests/post-picker.test.mjs tests/tiktok-multi-post-checkout.test.mjs tests/tiktok-short-links-checkout.test.mjs
npm run build

Draft PR: https://github.com/LitGnosis/Litix/pull/108
