# Litix Railway owned-evidence worker deployment

## Readiness state

This repository includes a **real first-party delivery-evidence processor**, not an SMM reseller/engagement executor. It processes authenticated delivery observations for approved website-preview or owned-app QA orders. It **cannot** charge cards, create orders, refill, mark an order delivered, or simulate likes/follows/views.

Railway has changed configuration systems. For **new** services in November 2026, Railway documents **Infrastructure as Code** in `.railway/railway.ts`, not legacy `railway.toml`/Nixpacks configuration (the latter is deprecated). The repository root owns the IaC file; the worker's Git source root is `ops/partner-ledger`.

The IaC file deliberately starts with **zero replicas and the worker disabled**. It has no plaintext credentials, no public port, and no automatic payment hooks. It declares only the named worker and uses Railway's partial ownership to avoid overwriting unrelated resources.

## Account setup — user must connect and authorize

1. Connect **Railway** in ChatGPT or log into a Railway account and link the `LitGnosis/Litix` repository. Connecting requires owner action; GitHub source availability does not grant Railway permission.
2. In the intended Railway project, run `railway config init` if needed and link the existing project; review this repository's `.railway/railway.ts`. Use `railway config plan` to preview resources before running `railway config apply`. Never apply a plan that unexpectedly modifies other services or incurs unapproved costs.
3. Create Redis in the same Railway project **after reviewing plan and cost**. Railway Redis commonly supplies a **private `redis://` URL**. The current worker intentionally requires **`rediss://` TLS**, so a default private Redis URI may NOT pass preflight. Either provision an explicitly TLS-enabled Redis endpoint (preferred) or develop, test and formally approve a private-network transport policy. Do **not** substitute `redis://127.0.0.1` or disable the check casually.
4. Provision variables via Railway service secrets **without committing them**:
   - `DATABASE_URL` — approved Neon `postgresql://...` with `?sslmode=require`, using a dedicated scoped read/write role on the approved `growth_ops` database/schema.
   - `REDIS_URL` — an actual reachable TLS `rediss://...` with authentication and ACLs for the evidence stream.
   - `LITIX_PARTNER_EVIDENCE_SECRET` — 32+ byte entropy, generated and stored through a secret manager; never paste its value into chat.
   - `LITIX_PARTNER_EVIDENCE_ENABLED` — keep `false` until all release gates pass. The IaC file is source of truth for this disabled flag.
   - **Do not add PayKings/NMI signing keys** to this Redis evidence worker. Payment webhook verification belongs to the separately reviewed merchant endpoint.

## Database release gates

- The connected production Neon database already exists. Its `growth_ops` migration was tested on a nonproduction branch, but is **not** installed on production.
- A new November 2026 manual snapshot attempt returned **`snapshots limit exceeded`**. One October 25 backup exists but is not a substitute for a fresh recovery point before production change. Do not delete existing snapshots/branches without approval. Resolve account quota with Neon or validate a separately encrypted, restorable export to an authorized backup destination first.
- Validate `006_partner_ledger.sql` and the necessary role permissions after a verified restore-capable backup. Never seed test money or use a default partner API token.
- Run signed-event replay, Redis restart, DB outage and order-isolation tests on an approved staging dataset. Verify no paid or synthetic social engagement orders are touched.

## Launch criteria

Only after the actual production backup, correct database role, private authenticated Redis, signed event producer and staging end-to-end pass:
1. Explicitly review changing the worker `replicas` from 0 to 1 and `LITIX_PARTNER_EVIDENCE_ENABLED` to `true` in a follow-up release.
2. Confirm Railway first starts with no live customer work, performs connections safely, and logs only sanitized outcomes.
3. Monitor consumer group pending entries, retries, database lock contention and process restarts.
4. Keep PR #183 (new payment dispatch) as a separate blocked decision until end-to-end merchant verification and signed payment settlement are confirmed.

**Do not run** `python3 -u fulfillment_worker.py` from the user's example: that filename is absent. The real entrypoint is `python -u -m litix_partner_ledger.worker`.
