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

### Staging route safety check — 2026-10-28

Before any project-route promotion, a full 53-rule comparison against current live routing version 53442328-4e3c-425b-83a3-96458ec5bd2f identified an unrelated pre-existing staged change that would have enabled /api/checkout legacy proxy route `3d603fe4-a251-43df-bf13-77c6e131fd4b`. **That would have modified checkout unintentionally.** The staged route was restored using Vercel's `restore:true`, returning its enabled flag to the currently live value `false`. No live checkout route was changed.

New staged version `3e5a60c5-2d7f-40c0-9370-d241b71dea4a` was then diffed rule-for-rule against live. Both contain 53 rules, and **only** `litix-seo-20261019-robots` and `litix-seo-20261019-sitemap` differ, each changing `enabled:true` to `enabled:false` and their descriptions, with external legacy destinations otherwise preserved. All API, payment, supplier, pricing and webhook routing settings match live.

The safe routing version is not considered published until it is explicitly promoted and production probes confirm native Next robots/sitemap, the six languages, existing checkout readiness and currently live Boostero categories.

Source branch for preserved crawler exclusions and legacy sitemap URLs: `fix/litix-global-native-seo-preservation-20261028`, PR #62. No customer data or charge is needed for this stage.

---

## Phase 1 continuity update: 2026-10-28 — exclusive new-order supplier safety

### Current verified starting point
- Pre-change production READY deployment: dpl_HYq34Z5VKbpTSywarvp2ZegKNyME
- Pre-change exact source: 40ce4ad92f1eb1dfdbdb7ac7b571ca27ce89dee7
- New non-destructive recovery branch: recovery/litix-global-master-phase1-20261028 (pinned to same SHA). Existing 2026-10-27 recovery and 2026-10-28 clean-card recovery branches retained.
- Source archive: GitHub Actions artifact `litix-global-master-pre-boostero-only-20261028`, run `40691158504`, artifact ID `12816902610`; source ZIP only, original commit 40ce4ad92f1eb1dfdbdb7ac7b571ca27ce89dee7, repository backup excludes secrets and data; retention 90 days. Download from https://github.com/LitGnosis/Litix/actions/runs/40691158504.
- Annotated original-source tag requested via limited-permission GitHub Actions job, only after no-charge tests and archive complete. Confirm tag exists before marking protection complete. Neither this recovery branch nor tag is automatically immutable without a repository ruleset.
- Current Neon main branch `br-long-term-awmdp29b`: observed 10 branches and 1 old snapshot; fresh DB backup remains blocked by snapshot and branch quotas. **No database edits were made.**
- Relevant Neon schema and verified uniqueness indexes documented in [LITIX-GLOBAL-NEON-SCHEMA-INVENTORY-2026-10-28.md](LITIX-GLOBAL-NEON-SCHEMA-INVENTORY-2026-10-28.md). Production DATABASE_URL fingerprint still needs independent verification.

### Critical supplier routing finding and safety fix
Live catalog previously returned non-Boostero numeric SMMGLOB items outside the four Instagram/TikTok Followers/Likes Boostero-only tabs. Direct numeric checkout in `src/app/api/[action]/route.js` would still charge via PayKings and then issue `smm("add")` for those new paid orders, contrary to the explicit Boostero-only new-order policy.

Isolated branch `feature/litix-global-boostero-only-hardstop-20261028` adds:
- Production-only hard stop to **all** legacy `/api/checkout` numeric SMMGLOB service orders, before payment or dispatch; `/api/checkout/v1` continues to route namespaced `boostero_123` through the existing approved Boostero checkout.
- Old numeric services remain visible as **unavailable for new purchases** (unchanged product count, prices, descriptions and IDs in source data). Customer cards and comparison cannot select their purchase path.
- Preserved historical `/api/track`, email lookup, customer notification resends, archived SMMGLOB status reads, reconciliation state, Boostero supplier status sync, pricing, bundles, Auth0 and transactional email logic.
- No live payment or supplier test orders, no database migration, no pricing change, no credential changes, and no historical order mutation.
- Dedicated CI validates production hard-stop (including an executable no-charge handler test), existing supplier checkout/reconciliation and order constraints, Next.js production build, and browser UI at 320/375/1280px.
- Read-only source archive and annotated recovery tag are generated by scoped CI; tag may require repo Actions contents:write permissions. Verify results and exact SHA before production promotion.

### Master-plan completion status (do not infer from file presence)
- **Live and observed:** approved Boostero four-category catalog, basic PayKings checkout readiness endpoint, manual growth bundles, order tracking, Resend integration code, Litix AI widget and basic help, Guardian, six localized marketing pages, mobile manifest, local-only Growth OS calendar, simplified service cards.
- **Limited / require verification:** successful payment-to-order idempotency under real callbacks, exact Resend delivery, live supplier dispatch and polling as of the new production SHA, authorized Auth0 customer isolation, full device PWA installability, private source-domain database identity.
- **Gated:** 864-service curated Boostero catalog (PR #58 draft; preview not paid), Instagram Choose Your Posts (PR #50 demo), owner wholesale (PR #53 Auth0 owner binding), fresh encrypted Neon database backup.
- **Not implemented completely:** authenticated Command Center, permissioned agency tenants, verified reviews and rewards ledger, full recurring subscription activation, multicurrency provider checkout, authorized analytics/data connection and content scheduling, complete AI 2.0 and comprehensive WCAG and performance audits.

### Remaining Phase 1 release gates
1. Verify both CI jobs and annotated recovery tag; test the exact merged source tree and Preview.
2. Deploy only the verified Boostero-only new-orders safety patch and smoke-test live catalog, four Boostero prices/quantity, all eight manual bundles, health, order tracking and payment *readiness only*.
3. Do not claim paid checkout or supplier completion verified without a controlled permitted transaction and records reconciliation.
4. Obtain a fresh Neon recovery point and verify Vercel runtime DB ownership before any paid post-picker, migrations, provider-wide wholesale cutovers, agency isolation or recurring billing work.
5. Review remaining source routes for old cron/bulk SMMGLOB dispatch and any historical automation behavior before claiming complete exclusive supplier isolation across every subsystem.
6. Keep the next phases on separate testable branches; do not merge draft PRs that have unverified supplier parameters or customer permissions.

---

## Neon Free-plan backup investigation and opt-in offsite PG18 recovery — 2026-10-28

- Account verified Free (Vercel-managed org `org-crimson-thunder-28377911`); manual snapshots 1/1, branches 10/10, six-hour recovery window; October 25 snapshot `snap-fragrant-hat-awyjlty1` retained. **No current data backup exists**; do not delete/reset data.
- New source recovery checkpoint: `recovery/litix-neon-free-plan-audit-20261028` at production SHA `86954ed6174cc8c9a100369e06e969a070e5e1ed`. Prior release tags and sanitized source archive unchanged.
- `docs/LITIX-NEON-RECOVERY-2026-10-28.md` documents exact plan limits, risks/estimated Launch charges, read-only schema/payment/reconciliation checks, Resend delivery metadata, and pending backup authorization.
- New `scripts/neon-backup-encrypted-offsite.sh` and `scripts/neon-restore-isolated-verify.sh`: manual-only streaming `pg_dump 18` + `age` private encrypted S3 object, remote ciphertext roundtrip, strict isolated restore target and database integrity checks. No credentials, database dumps or customer records stored in GitHub; automated CI tests only syntax and fail-closed preflight. **Scripts not run against live data.**
- Neon native remedy requires owner-approved Launch billing upgrade. Offsite alternative needs a private bucket, public age recipient/private key, direct production database connection and a separate empty restore destination; no external object storage or key verified in current connected environment. Approval required before importing billing credentials or exporting customer data to offsite destination.
- Existing seven paid records and seven unique transaction IDs found in connected Neon, no unlinked paid transaction there; this does not yet prove Vercel production runtime uses that branch. One Boostero fulfillment is SUBMITTED, not verified completed. Resend sent/delivered 19/19 in recent aggregate metrics. PayKings live charge, owner Auth0 sign-in, every email per-order guarantee, full 864 catalog and paid multi-post selection are **not** yet proven.
- Do not merge large draft paid PRs (#58, #50, #53) or modify schema/fulfillment logic until fresh recoverable DB backup, production DB identity, no-charge and permitted transaction checks have passed.

Current working public deployment remains `dpl_HqHcf9Sx1NfkoWYunrQvRyzeCHmX`, commit `86954ed6174cc8c9a100369e06e969a070e5e1ed`. This task is **safe backup preparation and audit**, not a declaration that the full master roadmap is complete.

---

## 2026-10-28 — No-new-subscription backup recovery validation

**Production and customers remain unchanged.** Production Vercel SHA `86954ed6174cc8c9a100369e06e969a070e5e1ed` READY. Source GitHub now contains the earlier recovery tooling, plus the separate source checkpoint `recovery/litix-pre-offsite-backup-20261028` at current merged Git SHA before this improvement. A sanitized source-only archive is produced for the verified live commit; it contains NO database dumps, secrets or customer records.

**Read-only current Neon inventory:** default project `fancy-wave-75069167`, Free, one old manual snapshot dated October 25; 10/10 branches; Neon object storage enabled but ZERO buckets. Distinct application databases `neondb` 13,803,520 bytes and `litixapi` 8,101,888 bytes. Both must be backed up and restored independently. Project storage and snapshots are NOT independent offsite backup. Neither was altered.

**Public GitHub limitation:** repository `LitGnosis/Litix` is PUBLIC. Uploading an encrypted production database backup as a public-repo GitHub Actions artifact is NOT approved. GitHub is only used for sanitized source backups and 100% synthetic-data tests. No destination/key/secret is added to GitHub or Vercel.

**Implemented improvements:** manual-only source database allowlist and dedicated archive names for both application databases in `scripts/neon-backup-encrypted-offsite.sh`; parallel strict isolated restore guardrails in `scripts/neon-restore-isolated-verify.sh`; `scripts/test-neon-encrypted-restore-synthetic.sh` proves PostgreSQL 18 `pg_dump -Fc` -> age -> decrypt -> `pg_restore` roundtrip for both synthetic schemas, including row counts, in separate disposable source/target containers. CI `litix-free-backup-validation-ci.yml` runs the no-secret safeguards, synthetic restore, and source-only production archive. No production tables, customer data, payment settings, catalog prices or supplier orders were changed.

**Known issue:** Vercel production environment contains no verified S3/Blob backup destination or age encryption identity; Neon branchable storage has zero buckets and is the same vendor failure domain; no private offsite storage is proven available/authorized, and no isolated actual-data restore target is ready. Fresh backup remains **NOT VERIFIED**. Do not start paid PR #58 (864 Boostero services), paid post picker #50, tenant accounts, loyalty ledgers or subscription migrations until both application DBs have independent fresh encrypted backups, restored successfully and production database identity is verified.

**Next owner decision, avoiding a new subscription:** authorize an already-owned PRIVATE offsite S3-compatible bucket (or choose an explicitly private independent destination), approve transfer of encrypted copies only, and hold the age private identity offline, separate from stored ciphertext. This requires new private storage/permissions and isolated restore access; never place credentials/keys in repository, public GitHub artifacts, chat or logs. Existing scripts do not execute on production without all safety prerequisites.

Refer to `docs/LITIX-NEON-RECOVERY-2026-10-28.md` and the separate CI proof for backup scope, no-cost alternatives and restoration limits.
