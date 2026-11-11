# Litix first-party reliability & wholesale status pipeline

**Staging code. Not a running live service.** This module is additive and deliberately does not change, charge, refund, complete, refill, or resubmit any existing paid Litix order.

## Why the provided two-script sample was not production-ready

- Redis `LPOP` destroys a pending telemetry item before durable processing; process crashes permanently lose it. This implementation uses Redis Streams consumer groups plus Postgres event idempotency, and acknowledges messages only after durable commit.
- A target shortfall is not evidence of a *drop*. A drop requires comparison with the last observed value, and even then needs verification. The code never automatically orders or sends refill work, and it never claims external public engagement is deliverable evidence.
- Redis status cache is not the financial/order authority. The live `public.litix_v2_orders`, PayKings outbox, and supplier history remain untouched.
- Calling a downstream webhook without a controlled destination, signature, replay ID, and retry policy invites SSRF, spoofing and silent loss. Downstream events in this code are HMAC-signed, allowlisted, dedupable, retried and dead-lettered in PostgreSQL.
- A default TikTok URL is not a real detected publication. No profile scraper or fake engagement node is supplied here. Use authorized publisher webhooks for legitimate content monitoring, if available.

## Architecture

`approved owned work -> signed event in Redis Stream -> Redis XREADGROUP worker -> transactionally persist evidence snapshot + review flag + webhook outbox in Neon -> dedicated outbound webhook worker -> approved reseller/customer listener`

The worker only accepts `website_preview` and `owned_app_qa` workload kinds backed by an authorized `public.master_fulfillment_grants` row, an `approved` row in `growth_ops.litix_owned_delivery_agreements`, and an owned job. Completion requires both a successful `master_node_jobs` record and an exact matching evidence reference in that job result. Zero counts, unverified counts, or partial counts do not trigger new purchases or automated refills. Late/out-of-order events are deduplicated/ignored for the current snapshot while remaining in the audit log.

## Files

- `litix_reliability/models.py`: signed event verification, status math, signed webhook payloads.
- `litix_reliability/telemetry_worker.py`: at-least-once Redis Stream processing, Neon transaction, outbox creation.
- `litix_reliability/webhook_dispatcher.py`: restricted HTTPS targets, public-IP check, signed delivery and exponential retries.
- `litix_reliability/capacity.py`: real-input operations capacity simulator, zero nodes = zero capacity.
- `sql/005_delivery_telemetry.sql`: additive migration for owned jobs only.
- `tests/test_reliability.py`: no-charge unit tests.

## Deployment requirements

1. Use an isolated Neon staging branch. Apply pre-existing PR #183 `db/001_master_node.sql` and `db/004_payment_and_fleet.sql` before `sql/005_delivery_telemetry.sql`. Verify the schema but **do not migrate production** until backups, roles, security and customer-order P0 #167 are resolved.
2. Provision a dedicated **persistent Python 3.11+ worker** (not a Vercel serverless request), e.g. a supervised container with private Redis and Neon connectivity. Install pinned/locked dependencies from `requirements.txt`; this repository's current Next.js `src/package.json` does not contain these Python dependencies.
3. Configure `DATABASE_URL`, `REDIS_URL`, secret-managed `LITIX_TELEMETRY_SIGNING_SECRET` (minimum 32 bytes), `LITIX_OWNED_TELEMETRY_ENABLED=true` **only after** production validation. Keep it false otherwise. Grant producer write-only access to `litix:owned:delivery:telemetry` via Redis ACL; consumers require isolated permissions for group, quarantine, and ack.
4. A trusted internal job processor publishes `XADD litix:owned:delivery:telemetry payload <exact JSON> signature <HMAC-SHA256>`. Each body requires `event_id`, `order_id`, `kind`, `observed_units`, `observed_at`, and `evidence_ref`. Sign the **exact bytes of the JSON** with `LITIX_TELEMETRY_SIGNING_SECRET`. Event IDs are unique UUIDs. Timestamp tolerance is 7 days for outage recovery, with Postgres unique event ID for replay protection.
5. Operator configures individual client destinations **outside public request parameters** in `LITIX_WEBHOOK_ENDPOINT_CONFIG_JSON` as `{"agency-abc":{"url":"https://agency.example/callback","secret":"<managed-32+-byte-secret>"}}`. `LITIX_WEBHOOK_ALLOWED_HOSTS` must explicitly list the approved callback hostnames. Store both variables in a secrets manager, never in a repo or consumer-visible API. `LITIX_OWNED_WEBHOOKS_ENABLED=true` only after authorization and test receipt. Apply outbound network firewall rules, DNS/TLS pinning as supported, and deny private ranges; the software DNS check alone is not sufficient to prevent DNS rebinding.
6. Seed only explicitly authorized first-party agreement records. This is not a public customer-enrollment API. Do **not** infer approved contracts from inbound telemetry, or trust unsupported supplier-side counts. One signed event is *not* proof of a settled payment or completed supplier delivery.
7. Test duplicate events, delayed events, restarts, signed callback replay handling, subscription suspension, customer status consistency, queue failures, and rollback in staging. Keep existing Boostero and PayKings flows unchanged.

### Feature flags

The new services start **disabled**. Configuring a signed event source, worker uptime, approved publisher platform events and external endpoints is required before any live usage. There is no guarantee of sub-minute post detection or perfect callback delivery.

## Verification

`python -m unittest discover -s tests -v`

`python -m compileall -q litix_reliability tests`

`python -m litix_reliability.capacity` performs a clearly labeled simulation with 0 actual nodes by default.