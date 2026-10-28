# LITIX GLOBAL — Phase 1 engineering handoff and master roadmap
Date: 2026-10-28 (America/Chicago)
Repository: LitGnosis/Litix
Vercel project: litix_final_logo_corrected_vercel_ready
Project ID: prj_ATrABQBmZbBlw3mpz04Pvnu7AxXv
Production domain: https://litix.net
Production READY deployment observed: dpl_4evMq2GjsFUg8jikj3JvtWvqXZ2o
Exact running source commit: b5e000bab3e80046f286bb25b6fc975a159622aa
Base branch: fix/litix-guardian-degraded-catalog-20261027
Phase 1 work branch: feature/litix-global-phase1-a11y-handoff-20261028

## Production preservation and rollback

- Git recovery branch: recovery/litix-default-master-production-20261027, pointing to b5e000bab3e80046f286bb25b6fc975a159622aa.
- Annotated backup tag: litix-default-master-pre-global-20261027. GitHub object is annotated and resolves to the same commit; GitHub rulesets/immutable protection are **not** confirmed.
- Original source archive: LITIX-DEFAULT-MASTER-BACKUP-PRE-GLOBAL-UPGRADE.zip.
- SHA-256: 5fd8426d927ccba0a93ebf33b2d92723afe40f4e84a76158f6c447a6e6b386f0.
- Private ChatGPT Library: /Litix/Recovery Backups/LITIX-DEFAULT-MASTER-BACKUP-PRE-GLOBAL-UPGRADE.zip.
- GitHub Actions recovery artifact (90-day retention): https://github.com/LitGnosis/Litix/actions/runs/40635391960.
- This safe archive contains tracked source and manifest, not passwords, API tokens, complete environment settings/values, or customer data. A credential-like fixture in one file was sanitized; restore the original unmodified source from Git tag.
- Production database: Neon project fancy-wave-75069167, main branch br-long-term-awmdp29b. Manual snapshot snap-fragrant-hat-awyjlty1 is dated 2026-10-25 (not a current backup). A fresh snapshot returned HTTP 422 'snapshots limit exceeded' and a new branch returned 'branches limit exceeded'. Do not delete old branches/snapshots without separate review; do not execute production migrations or paid-supplier cutovers until a new tested, encrypted database recovery point is available.
- Do not assume the configured production database URL matches this Neon project without read-only runtime verification. Never print or export DB credentials.

Restore source through the pinned SHA (Git branch/tag), not the main branch:
```bash
git fetch origin --tags
git checkout --detach b5e000bab3e80046f286bb25b6fc975a159622aa
cd src
npm ci --no-audit --no-fund
npm run build
```
Restoring production requires independently verifying the current target deployment, domain assignment, current approved Vercel environment variables, data-schema compatibility, and the exact production SHA. Stage a separate recovery deployment, run nonbilling smoke tests of checkout/PayKings card fields, Auth0, Resend, Boostero, bundles and historical orders, then promote the verified source. **Never** overwrite production databases or replay paid orders to restore web code.

## Existing source functions — do not replace

- Next.js 15 app in src/ (package-lock.json pinned).
- PayKings Collect.js checkout, legacy approved Bluevine bundle routes, Launch/Momentum/Power/Apex manual bundle handling, order notifications/Resend, Auth0-supported customer authentication; each integration still needs an end-to-end release gate.
- Four Boostero allowlisted production service categories (Instagram Followers/Likes and TikTok Followers/Likes); public frontend sorting already prioritizes those categories and numeric USD/1000 rates.
- Private supplier mappings and historical SMMGLOB order records must be maintained independently. Public production API still returns some 'boostero_' service identifiers in JSON — customer-facing card redaction is not full network-level privacy.
- Guardian /api/guardian and /api/internal/boostero cron paths, Litix AI read-only concierge and authenticated-order-lookup widget, WhatsApp floating support.
- Growth plan and campaign workspace in src/app/page.jsx are primarily browser-local planning tools, not authenticated cross-device account workspaces or official social analytics.
- Mobile AI/WhatsApp float geometry is already covered by src/tests/litix-floating-buttons-mobile.mjs.
- The existing src/vercel.json has cron jobs for catalog, bundles, Guardian and Boostero. Confirm quota/permission behavior before changing scheduling; do not assume a cron route's presence establishes actual scheduled delivery.

## Existing upgrade candidates — gated, separate PRs

- PR #58: Premium Boostero 864 compatible Default-type candidates across 14 platforms, displayed in read-only Preview; no paid activation. About 919 other supplier entries were not activated. Source: https://github.com/LitGnosis/Litix/pull/58. Needs reconciliation, per-service parameters, 1.60x price proposal versus $5 floor / prior margin constraints, persistent opaque ID server mapping, production DB backup, final no-charge PayKings and supplier routing tests.
- PR #50: Instagram 'choose posts' preview and multi-post ledger with demo checkout; not payment-ready. Source: https://github.com/LitGnosis/Litix/pull/50. Requires approved Meta access, supplier compatible semantics, testing one parent payment -> independent child order ledger and retries; TikTok media preview is not verified.
- PR #53: Owner wholesale dashboard gated pending binding to a verified Auth0 owner principal. Source: https://github.com/LitGnosis/Litix/pull/53. Never expose wholesale via public toggles, query strings, browser state, or unverified email addresses.
- Prior feature PRs for bundle/notifications/Guardian were not all merged; assess deployed code individually rather than assuming closed/open PR status means live behavior.

## Priority / release gates

### Phase 1: Stabilize and preserve (current)
1. [x] Verify exact READY production deployment and create a pinned source recovery branch, annotated tag and downloadable archive.
2. [x] Preserve a separate copy of safe original source in private Library and GitHub artifact.
3. [ ] Obtain **fresh, tested Neon database backup**; quotas exceeded (external blocker), protect DB and existing customer data. No risky paid checkout/migrations meanwhile.
4. [ ] Prove all payments, webhooks, order idempotency, live order reconciliation, historical orders and manual bundles via no-charge fixtures and approved read-only runtime tests.
5. [ ] Confirm Boostero 4-category allowlist and keep non-compatible services unpurchasable.
6. [ ] Complete Select Post with permission-controlled media reads and safe aggregated checkout; keep demo isolated.
7. [ ] Add baseline CI and low-risk nontransactional improvements to AI usability and mobile accessibility.
8. [ ] Validate catalog sorting and mobile controls at 320/375/390/430/1280 pixels and refresh without changing prices.
9. [ ] Verify Resend owner/customer notifications, deduplication, Auth0 and Guardian alerts with authorized nonpayment tests.

### Phase 2: Trusted customer workspace
- Auth0 user principal and server-side ownership checks; orders/receipts/tracking/support; source-of-truth database.
- Verified purchase-only reviews and moderation; customer loyalty with ledger, antifraud and protected redemption.
- AI 2.0 with verifiable catalog and order help, restricted tool access and escalation; content assistance without fabricated metrics.
- Subscription activation only after provider and payment authorizations, lifecycle tests and policy review.

### Phase 3: International / business
- English, Spanish, Portuguese, French, German and Arabic with RTL, hreflang and reviewed legal strings.
- Explicit currency conversion display and approved provider-checkout currency, region-aware tax/legal rules.
- Agency workspaces with tenant isolation, permissions, reports and referral abuse controls.

### Phase 4: Litix Growth OS
- Real content calendar, reusable campaigns, original AI captions, reporting from authorized platform APIs, opt-in PWA, measurements and accessibility/performance work.

## Nonnegotiable release gates

- Tests: npm ci; existing node --test suites, build; responsive browser checks and zero unauthorized payment/supplier calls.
- Document exact changed files, environment variable **names only**, branch, commit SHA, Preview deployment, smoke-test outcomes and known gaps for every PR.
- Block production release without current recoverable database snapshot for migrations/fulfillment changes; explicit owner-approved payment-provider/platform permissions before enabling new purchase/subscription routes.
- Verify payment-tokenization keys are never exposed server-side, no raw card storage, owner pricing hidden from public users, no supplier code or wholesale values in public endpoints.
- No silent price edits; compute 1.60 * verified Boostero cost, check $5 checkout floor, unit minimums, margin guards, locked bundle prices and flag conflicts for review.
- Preserve all old paid orders and supplier identities in private audit/fulfillment records; never reroute historical orders to Boostero.
- Only describe features as live after READY production alias and actual route/user-journey checks.

## Current implementation focus

This Phase 1 branch is independent of payment, supplier routing, DB migrations and prices. The first low-risk change improves keyboard and reduced-motion behavior of existing Litix AI and includes simulated mobile browser tests. It must remain preview-only until all tests pass. This document records the broader work; roadmap entries marked unchecked are NOT implemented.

## October 28, 2026: Released Global marketing localization and SEO route repair

### Already deployed and verified
- Six independently rendered informational landing pages (English, Spanish, Portuguese, French, German, Arabic with RTL), premium existing brand layout, language switcher, canonical and hreflang metadata; no international payment activation.
- Production commit df21f6620082fe10f88d2af66f0bade4ed3febf1, Vercel deployment dpl_CZPf5EYLm9VgMuqUxDdHXUrnVH9q READY on litix.net.
- PR #61 merged. CI run 40680633349 passed no-charge payments/supplier regression and mobile browser tests; production homepage, Spanish/Arabic marketing, checkout readiness, live four-kind catalog and eight manual bundles returned HTTP 200.
- Original and Phase 1 recovery branches remain preserved; live database backup still not fresh.

### SEO routing discovery and repair gating
- The project has **53 Vercel routing rules**. Two enabled, independently configured October 19 rewrites intercepted /robots.txt and /sitemap.xml and served stale static artifacts from litix-seo-build-artifact-20261019-dbusk7dtk-litgnosisllc-9049.vercel.app.
- Previously live Vercel routing version: 53442328-4e3c-425b-83a3-96458ec5bd2f. Do not change unrelated routes, especially payment, supplier, webhook, pricing, tracking or privacy compatibility rules.
- Two SEO-only routes (IDs litix-seo-20261019-robots and litix-seo-20261019-sitemap) were set to enabled:false in a **staged, not-yet-promoted** routing version 3cbcb5de-e918-4862-815f-90e0ff50aa17. The original proxy URLs remain in the rule payload for restoration. The Vercel routes staging alias returned the native Next sitemap with 6 language alternates, and native robots; production route version was unchanged at this stage.
- Before promoting the SEO route version: preserve prior crawler disallows (/api/, /account, /signin, /checkout and admin panels) in src/app/robots.js. Include legacy previously indexed marketing paths (/about, /platform, /acceptable-use, /resources/visibility-acceleration) in the native sitemap alongside original terms, privacy, refunds and all six languages. Test native Next built route content in CI and staging, deploy the pinned verified source, then re-verify Vercel staged rules with a diff limited to two SEO IDs.
- This fix does NOT certify search engine indexing. Search Console property access and crawl outcomes remain unverified. Avoid deleting or repointing the other project routes.

### Still not implemented
- Paid Boostero 864-service expansion, allowed supplier cutover, new subscription billing, consolidated multi-post paid checkout, full Auth0 customer dashboard, cross-device agency workspaces, verified loyalty ledger, automated global taxes and international payment methods, authentic review purchase verification, official social-platform analytics and full Litix Growth OS.
- These require separate safety checks, provider permissions or verified current DB recovery. Do not call them live just because Preview pages exist.
