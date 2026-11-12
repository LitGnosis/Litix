# Litix Global Phase 1 — read-only Neon schema inventory
Verified: 2026-10-28
Neon project: fancy-wave-75069167 (name: neon-blue-kite)
Branch: br-long-term-awmdp29b (main)
Method: PostgreSQL information_schema.columns and pg_indexes via SELECT only. No customer records, password values, data modifications or SQL exports.
**Production mapping not independently proven:** runtime Vercel DATABASE_URL may point to a different project until a read-only production connection fingerprint is checked.

## Critical existing tables (76 columns across five tables)

| Table | Columns |
|---|---|
| litix_v2_orders | id, email, service_id, service_name, category, destination, quantity, amount_cents, supplier_cost_cents, payment_state, fulfillment_state, supplier_order_id, payment_transaction_id, idempotency_key, tracking_token_hash, metadata, last_supplier_status, payment_attempted_at, supplier_attempted_at, created_at, updated_at |
| litix_boostero_services | supplier_service_id, platform, retail_per_1000_cents, wholesale_ceiling_per_1000, enabled, approved_by, approved_at, service_kind |
| litix_boostero_fulfillment | litix_order_id, supplier_service_id, payment_mode, state, supplier_order_id, purchase_attempt_id, attempted_at, supplier_status, checked_at, error_code, approved_admin_id, created_at, updated_at |
| litix_boostero_attempts | id, litix_order_id, kind, state, supplier_order_id, started_at, finished_at, error_code |
| litix_growth_bundle_orders | id, email, customer_id, package_id, platform, package_name, price_cents, package_items, max_posts, payment_state, order_state, gateway_transaction_id, idempotency_key, tracking_token_hash, approved_at, settled_at, terms_accepted_at, profile_ref, created_at, updated_at, followers_fulfilled, payment_provider, customer_whatsapp, bluevine_payment_reference, phone_e164, sms_consent_at |

## Observed unique constraints / indexes (verified by read-only pg_indexes)

- litix_v2_orders: unique primary id, idempotency_key, payment_transaction_id, supplier_order_id.
- litix_boostero_fulfillment: unique litix_order_id, purchase_attempt_id, supplier_order_id. Secondary index (state, updated_at).
- litix_boostero_attempts: unique primary id; unique (litix_order_id, kind).
- litix_boostero_services: unique supplier_service_id.
- litix_growth_bundle_orders: unique primary id, idempotency_key, gateway_transaction_id; conditional unique Bluevine payment reference; pending Bluevine state index.

These database safeguards are useful but do **not** by themselves prove all callbacks, payment and supplier operations are exactly-once. Source-level and nonbilling functional tests are still required.

## Recovery and migration gate

One manual snapshot remains on this Neon project: snap-fragrant-hat-awyjlty1, created 2026-10-25T22:06:36Z. Fresh snapshot creation previously returned HTTP 422 `snapshots limit exceeded`; branch count is at the ten-branch limit. Six-hour history retention is not a substitute for an independently retrievable current backup. Do NOT delete any historical snapshots or branches without separate authorization, or run schema migrations until a new verified recovery point is available.

The companion source-only artifact is in the GitHub Actions run for `litix-global-exclusive-ci.yml`. Git recovery branch `recovery/litix-global-master-phase1-20261028` pins commit `40ce4ad92f1eb1dfdbdb7ac7b571ca27ce89dee7`. This source archive is **not** a database backup.
