# Litix first-party partner ledger — staged security upgrade

**Status:** Additive migration and separately hosted worker source. Not active in production; nothing in this package submits a supplier order, adds synthetic social engagement, changes a paid order, charges a card, or claims delivery based on elapsed time.

## Intent
Replace the unsafe pasted demo with a narrow, independently auditable partner accounting and delivery-observation layer for **approved first-party** workloads (`website_preview`, `owned_app_qa`). All new partner accounts are disabled until a trusted administrator has verified actual contracts and merchant authorization. There is no default API token, no $5,000 seed balance, and no buyer-supplied wallet credit.

## Tables and accounting
- `growth_ops.wholesale_partners`: records only SHA-256 fingerprints of independently generated **high entropy** partner API tokens, never plaintext tokens, with `is_active=false` initially. Authorize tokens and scopes in a separate, reviewed API; this package does not expose a public new-order endpoint.
- `growth_ops.wholesale_wallet_entries`: immutable-source ledger entries are meant to be written **only by a trusted payment reconciler** after confirmed settlement/refund/correction. The dashboard balance view derives from actual entries; zero seed entries means zero funded balance. Restrict table insert/update/delete privileges to trusted financial actors before production.
- `growth_ops.wholesale_delivery_orders`: only independently registered, paid and approved first-party orders receive delivery observations. The worker cannot insert new orders or change payments.
- `growth_ops.wholesale_delivery_events`: signed, idempotent observations with timestamp validation; order snapshots are updated transactionally with the audit event. `COMPLETED` is **not** assigned by the worker. A fully reported request becomes `AWAITING_VERIFICATION` with evidence or `NEEDS_REVIEW` without evidence.
- `growth_ops.wholesale_wallet_balances`: computed view over ledger entries, not a freely mutable balance column. Negative balances are not an approved purchase mechanism; a real authorized debit writer must lock the partner and enforce an available-funds check.

The `verified_payment_ref` is an internal reference to a **separately verified** merchant transaction. It is never trusted from a public client payload. No partner tokens or session cookies are passed through Redis.

## Persistent event worker
The `litix_partner_ledger.worker` daemon uses Redis Streams with `XREADGROUP`, `XAUTOCLAIM`, and idempotent PostgreSQL event inserts. It acknowledges an event **only after its PostgreSQL transaction has committed**. Invalid signed payloads are quarantined; database failures retain pending events for redelivery. No `BLPOP` data loss, no `asyncio.sleep` fake fulfillment and no engagement macros.

Producer contract: publish exactly `{payload:<compact JSON>,signature:"sha256="+HMAC_SHA256(secret, raw payload bytes)}` to stream `litix:partner:delivery:evidence`. JSON contains `event_id`, `order_id` (both UUIDs), `observed_units` (integer), `observed_at` (UTC ISO8601), and `evidence_sha256` (null or lowercase 64-hex). Only trusted first-party agents may emit events. The signing secret must be provisioned on a dedicated, private host with rotation and ACLs.

## Configuration
Set `DATABASE_URL` to a **real** managed Neon database and `REDIS_URL` to a working TLS `rediss://` Redis endpoint. Use managed secret storage and no plaintext files in Git. The supplied `[USER]`, `[PASSWORD]`, `127.0.0.1`, `REPLACE_WITH_SECURE_GENERATED_PASSPHRASE` strings were placeholders, not working credentials. Never put a signing secret or customer API token in a public environment variable.

```bash
python -m unittest discover -s tests -v
python -m compileall -q litix_partner_ledger
# Only after migrations/backup/worker permissions/real trusted event producer:
LITIX_PARTNER_EVIDENCE_ENABLED=true python -m litix_partner_ledger.worker
```

Install reviewed, locked Python dependencies in a dedicated virtual environment. The active Litix Next.js project on Vercel is not a Linux systemd host and cannot run this infinite worker as a background process.

## Required release gates
1. Apply `db/006_partner_ledger.sql` and its rollback assessment first to **an isolated staging Neon branch** with zero live customer transactions. Rerun to verify additive statements and view; no production migration until branch backup, role review and financial authority verified.
2. Create the partner token issuing service with scope restrictions and a strong random token; share tokens through authorized secret delivery only. **No default partner is authorized or funded by this migration.**
3. Confirm PayKings/NMI settlement sources and merchant category before introducing a chargeable first-party wholesale offer. Existing V2 orders and PayKings outbox are not automatically replayed or charged.
4. Provision a dedicated persistent worker host, TLS-only Neon and Redis connections, a separate low-privilege database role, firewall/ACLs, and trusted internal publisher. Use non-root systemd controls from PR #185 when applicable.
5. Run replay, duplicate, queue outage, DB outage, timestamp, no-payment rejection, and review-gating tests. Validate end-to-end with consented first-party QA records only.
6. Keep all feature flags off and checkout/Boostero routes unchanged until explicitly authorized release. Production P0 incident #167 remains an independent customer support priority.

**No claim:** the source alone does not guarantee 60-second monitoring, new earnings, actual device capacity, or direct delivery.
