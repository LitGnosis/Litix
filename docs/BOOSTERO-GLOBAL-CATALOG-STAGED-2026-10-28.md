# Litix Boostero Global Catalog — Non-production Stage 1 (2026-10-28)

## Deployment and baseline safety
- Immutable production recovery commit: `a4d1d152fda00444242174bc4b668c08a18648f8`
- Production deployment to preserve: `dpl_68nf7SLM7QBztTTPVzHrqrsV7qhY`
- Working recovery reconciliation (still draft): [PR #83](https://github.com/LitGnosis/Litix/pull/83)
- This branch is stacked on the PR #83 recovery branch. Do NOT merge directly to main or promote preview until the recovery branch/CI and payment regressions are approved.
- This stage never changes the four approved checkout services, checkout handler, PayKings keys, Bluevine bundles, or customer records. Vercel auto-custom-domain reassignment remains disabled.

## Actual authenticated Boostero API audit
Read-only preview `GET /api/internal/boostero/catalog-audit` queried Boostero `services` through the existing configured server-side key, with no supplier `add` or payment call.
- Retrieved: **1,816** (live, dynamic; not hardcoded)
- Valid normalized: **1,814**; invalid: **2**; duplicates: **0**
- Simple input-shape candidates: **225**. This is a parser classification, NOT evidence of provider fulfillment compatibility or public purchase approval.
- Requiring additional service-specific input/fulfillment logic: **1,589**.
- Publicly approved paid services in production: **4**, separately verified in `litix_boostero_services`; no new services enabled by this stage.
- Platform groups are returned dynamically; no hardcoded final service count.

## API and UI
- `GET /api/internal/boostero/catalog-audit` (Vercel Preview only): dynamic supplier counts, platform, kind and type breakdown, cached for 5 minutes.
- `GET /api/internal/boostero/catalog-audit?view=items&page=1&platform=YouTube&kind=views`: sanitized 24-item pages without wholesale pricing or purchase capability.
- `/global-catalog-preview`: premium blue metallic, mobile-first read-only catalog explorer. Explicitly not customer checkout.
- `GET /api/internal/boostero/inventory-owner`: production owner-token authenticated, paginated inventory review, available only after activation and migration.
- `POST /api/internal/boostero/inventory-sync`: owner-only refresh, disabled by default.
- `GET /api/internal/boostero/inventory-sync`: CRON_SECRET authenticated daily sync, disabled by default.
- To activate future production inventory sync after migration, set `LITIX_BOOSTERO_GLOBAL_SYNC_ENABLED=true` in the production environment **only after separate review and approval**. Do not set it during this preview phase.

## Additive database migration
- `src/db/migrations/20261028-boostero-global-inventory-additive.sql` adds inventory and sync-history tables. No change to `litix_boostero_services` or orders.
- Applied and confirmed on isolated **litix-monthly-integration-test** Neon project's `neondb`, **not** either production Neon database.
- SQL `EXPLAIN` validated the JSONB batch upsert and conflict-update plan without writing synthetic orders.
- Full inventory import into production DB has **not** been performed.
- Removed/discontinued services are marked inactive only after a complete valid snapshot; historical inventory rows are never deleted.

## Future production enablement gates
1. Verify provider-specific order input forms (comments, packages, subscriptions, drip-feed, auto-likes, profile/post/multi-post), link validation, payment and idempotency per service kind.
2. Approve retail pricing using actual wholesale costs, the existing minimum $5 purchase, and profit safeguards; NEVER reveal wholesale publicly.
3. Validate migrations and 1,814-record staged import with tests and reconciliation.
4. Run checkout/tokenization, owner email, tracking, Bluevine and Safari regression tests with no unnecessary live charges.
5. Review service types that the API does not substantiate. Boostero documents POST `services`, API v2, `Default`, `Custom Comments`, `Subscriptions`, drip-feed flags, etc.
6. Approve and promote only a READY, validated production-target deployment, preserving existing working production until then.

## Data safety
No SMMGLOB or SMMFOLLOWOM supplier calls or new public supplier routing. No wholesale prices in client responses. No private keys or customer records in Git history. R2 backups remain a separate unresolved task.
