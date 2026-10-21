# Litix.net — Unified Vercel Bot Update Kit

**All nine ZIP uploads are represented here, deduplicated. This package is a source-update kit, NOT a standalone Litix website.** Importing this ZIP directly as a new Vercel project would not deploy the actual storefront. The Vercel bot must apply it to the existing full `LitGnosis/Litix` Git source first.

## What is included

| Source group | Included content | Deployment disposition |
| --- | --- | --- |
| Email tracking, order notifications, Oct 20 update kit | Canonical notification module, API cron route, SQL reference, guarded source installer | Default staged merge, subject to checkout compatibility |
| Enterprise SEO preservation | Next.js SEO pages, metadata/schema/CSS, installer | Default staged merge if no collisions; adjusted X references to YouTube and preserved the original hero |
| Protected 365-day refill CI/CD | Supplier price/refill policy helper, source installer, tests, workflow, checkout canary | **Opt-in** because it restricts catalog and changes custom price logic |
| Simplified Auto Boost | Offer/pricing logic, browser design preview, tests, implementation notes | **Handoff/reference only** until backend monitoring, real pricing and fulfillment are verified |
| `Litix-main 2`, `Litix-main 2(1)`, `Litix-main 3`, `Litix-main 4` | Identical 18-byte README placeholders | Provenance copy only; no app source |

The notification fixes uploaded as `Litix-Email-Tracking-Fix-FRESH(2).zip` and `Litix-Source-Notification-Fix-2026-10-19(2).zip` are byte-identical to the canonical notification assets in the earlier Default Update Kit. Duplicate copies are intentionally removed.

## One-command instructions for Vercel bot

1. Read `VERCEL-BOT-PROMPT.txt`.
2. Check out the complete **current production source** from the existing linked Git repository; do not use the empty Litix-main placeholders or the separate PayKings service as a website.
3. Put this update kit outside the Git checkout and run from anywhere:

```bash
node /path/to/kit/scripts/apply-to-repo.cjs --check /path/to/Litix
node /path/to/kit/scripts/apply-to-repo.cjs --apply /path/to/Litix
```

`--check` applies selected patches only to isolated copies of the files and refuses incompatible source signatures. `--apply` commits compatible file changes to the checked-out repository with in-process rollback on I/O failure, without changing Vercel Production. It does not change secrets, database rows, or domains.

Optional only after catalog and pricing review:

```bash
node /path/to/kit/scripts/apply-to-repo.cjs --check /path/to/Litix --include-refill
node /path/to/kit/scripts/apply-to-repo.cjs --apply /path/to/Litix --include-refill
```

If SEO conflicts with a newer customized page, use `--skip-seo` and manually reconcile it (never overwrite the newer page). The optional refill patch may reject a site that already has its helper; review instead of forcing or duplicating it.

## Test and release gates

- Confirm correct Vercel project: `litix_final_logo_corrected_vercel_ready`, team `litgnosisllc-9049`, domain `litix.net`.
- Preserve existing package and custom-order prices unless the explicitly reviewed refill-policy change is requested.
- Keep brands, animated platinum-blue styling, merchandise, packages, supplier endpoints, and all existing cron definitions.
- Run `node --test patches/auto-boost/tests/offer.test.mjs` (from the extracted kit), then app tests and `npm run build` from actual app root (usually `src/`).
- Validate the original Next.js checkout remains operational; NMI's `Invalid gateway response` must be resolved separately. Do not flip payment-enabled flags or process live cards as a smoke test.
- Preview first using an **isolated Neon database**. Verify confirmation emails, tracking and cron authentication. Only after verification request approval for production.
- The original source relies on Vercel **environment-supplied build patches**. Check those build overlays and how they interact with durable source changes; do not duplicate payment/SEO/refill installations.

## Why no full-site ZIP is claimed

Every uploaded `Litix-main` ZIP contains only `Litix-main/README.md`, not an `app/`, `public/`, `package.json`, or actual source. The other ZIPs are source patches, helper code and previews. A complete deployable website requires the existing full Git checkout. Do not overwrite the production storefront with an invented replacement or deploy this kit alone.

## Origin and safety

The archive does **not** contain credentials or Vercel environment values. Each selected source patch runs on a staging copy first. The SEO source has had marketing references normalized to the user's actual Instagram/TikTok/YouTube catalog and no longer removes “Metrics That Move / Analytics Amplified” from the existing hero. Original upstream source notes remain in patch READMEs. Verify all changes against the live code; bot release to Production is not automatic.
