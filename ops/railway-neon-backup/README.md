# Neon → Railway recovery archive (backup-only)

This service is a **read-only, write-once export helper** for the original Neon project `fancy-wave-75069167` (main branch `br-long-term-awmdp29b`).

## Purpose
Until Neon restores its compute quota, all three databases (`neondb`, `litixapi`, `litgnosis_platform`) reject even `SELECT 1`. This script makes no changes when source is unavailable. When access returns, it exports each database with PostgreSQL 18 `pg_dump -Fc --no-owner --no-acl`, verifies archives with `pg_restore --list`, and uploads them to the project's **private Railway object-storage bucket** with recorded SHA-256 metadata, byte-size checks, and a completion manifest written last.

## Invariants
- Never restores dumps, executes schema migrations, changes DNS, charges a card, starts a fulfillment worker or activates checkout.
- Source connections set `default_transaction_read_only=on`; no SQL DML/DDL.
- No passwords or customer data in logs, GitHub commits or CI artifacts.
- Backup completion marker prevents repeat exports on later scheduled runs.
- Partial archive errors leave no completion marker. The next run can retry.
- Archive metadata is for integrity, **not** proof that records are fully reconciled with merchant settlements or worker outboxes.

## Production Railway configuration
- Project `8ad1c0af-0ee5-4695-a093-ba5539ff8622` (Litix).
- Dedicated recovery service; build root `/ops/railway-neon-backup`; Dockerfile at root.
- Private bucket `litix-neon-private-recovery` (bucket ID `373ede72-c448-4633-b688-9357aaa136a3`).
- Secret variables `NEON_SOURCE_NEONDB_URL`, `NEON_SOURCE_LITIXAPI_URL`, `NEON_SOURCE_LITGNOSIS_PLATFORM_URL` are set directly through the authorized Neon→Railway integrations, never committed.
- Bucket variable references: `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` set to Railway bucket native references.
- No public service domain, network port, or inbound API.
- Proposed schedule: every six hours until the write-once backup succeeds, then subsequent runs are no-ops.

## After first successful backup
1. Verify `complete.json`, individual `*.dump` sizes, remote SHA-256 metadata and `pg_restore --list` files.
2. Export source catalog/order/payment/outbox counts in a controlled, read-only session; compare with merchant settlement and supplier receipts.
3. Restore to an isolated **staging** database with reviewed role/schema ownership and safe no-dispatch flags. The existing Railway PostgreSQL service is NOT a verified copy until then.
4. Only after idempotency, Stripe/NMI webhooks and fulfillment reconciliation can production traffic be considered for cutover.

Neon quota repair is still a separate Vercel-managed Neon account billing action. This service never bypasses quota enforcement.
