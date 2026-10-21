# Unified update kit reconciliation

The original uploaded kit is preserved under `unified-kit/`, including reference-only assets and provenance placeholders. It is not a second website.

- Notifications: installed guarded checkout hook, authenticated worker and all existing crons retained. Additive migration: `migrations/20261021_order_notifications.sql`. Must be reviewed/applied to an isolated database before verifying delivery. No database migration has been executed by this change.
- SEO: reconciled with existing overlay, retained original branded hero and normalized marketing references to Instagram/TikTok/YouTube.
- Refill: existing integrated, tested 365-day policy and 8x custom quote are retained, including fallback restrictions; do not run the original non-idempotent installer again.
- Auto Boost: existing simplified UI and confirmed coverage remain. Unsupported discovery, unverified prices, optional add-ons and bundled fulfillment are NOT activated by the illustrative kit assets. Existing backend readiness guards remain.
- Workflow YAML and standalone preview are retained as reference assets; the nested YAML is not an active GitHub Actions workflow. Maintainer activation is still required.

The build runs notification installation after legacy environment overlays, failing closed on incompatible existing notification code rather than overwriting it. Current production payment repairs must be independently checked before promotion. Local compilation and mock tests do not prove delivery, settlement or real supplier coverage.
