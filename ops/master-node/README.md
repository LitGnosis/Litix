# Litix owned master-node — controlled first-party fulfillment reference implementation

**Status:** Source package only; **not** deployed, not connected to live payments, and not a claim of $10K/week revenue. The code intentionally does not automate platform likes/follows, operate fake accounts or evade bans/geo-restrictions/rate limits. A proxy health controller is provided only for authorized first-party network operations.

This package is designed for the user's existing Next.js App Router, TypeScript, Neon/Postgres and Vercel setup. Use it for genuine first-party offerings (website preview generation and Litix-owned Android QA). The existing Boostero storefront stays unchanged.

## Included files

- `app/api/fulfillment/master-node/route.ts` — signed, replay-resistant, payment-grant-gated, idempotent order intake.
- `lib/infrastructure/device-farm.ts` — owned Android application smoke tests on an isolated and wiped emulator; strict package allowlist.
- `lib/network/proxy-rotator.ts` — SOCKS5 link health monitor, quarantine on congestion, and stable allowed job routes, **not identity rotation to defeat restrictions**.
- `components/DirectFulfillmentPulse.tsx` — high-end responsive Tailwind dashboard powered by actual aggregate Postgres telemetry.
- `app/api/fulfillment/pulse/route.ts` — sanitized public metrics with fail-closed preview behavior.
- `app/api/fulfillment/health/route.ts` — explicitly owned lightweight HTTPS probe destination.
- `lib/infrastructure/master-client.ts` — signed trusted server client for an already-authorized first-party job.
- `app/direct-fulfillment/page.tsx` — opt-in first-party landing page that embeds the truthful pulse component.
- `lib/infrastructure/master-node-queue.ts` and `worker/master-worker.ts` — PostgreSQL `FOR UPDATE SKIP LOCKED` scheduler, owned-node affinity, leases, recovery triage, completion audit.
- `worker/probe-egress.ts` — monitored link latency from private approved SOCKS5 networks to an explicit owned URL.
- `db/001_master_node.sql` — additive schema; no writes to old Litix orders.
- `infra/master-node-architecture.mmd` and `infra/network-blueprint.md` — execution diagram, zones and operational blueprint.
- `tests/security.test.ts` — request signing, allowed workloads and HTML-escaping tests.

## Prerequisites

1. Existing Next.js TypeScript project with Tailwind, Node 22+ and existing Neon/approved production branch. Add dependencies from `package.additions.json` and merge scripts instead of overwriting the site's `package.json`.
2. Run `db/001_master_node.sql` through reviewed migration tooling with a proper backup and separate development/staging environment first.
3. **Verify real merchant authorization for any first-party service SKU and customer payment.** The only safe grant writer is Litix's existing trusted payment-settlement verification path (or a separate authenticated owner-authorized $0 QA process). In that existing trusted code, after checking provider signature, amount, settlement state and service eligibility, upsert a `master_fulfillment_grants` row, preserving transaction identity and an audit trail. This adapter cannot be safely completed without reviewing the real PayKings/NMI order tables and their live workflow. No customer-facing route in this package creates grants.
4. Generate a random signing secret of at least 32 bytes through the deployment secret manager. Use it only between Litix's verified internal service and API. Keep actual `DATABASE_URL`, all proxy credentials and service secrets out of client bundles, Git, and logs.
5. Provision one **owned, isolated persistent worker** machine (or per-node containers). Vercel Route Handlers should accept jobs and return quickly; they must not run persistent device emulators or queue loops.
6. Manually register the owned worker node in `master_execution_nodes` after validating its OS, identity and connectivity, e.g. for development **only**:

```sql
INSERT INTO master_execution_nodes(id,kind,owned,enabled,capacity)
VALUES ('owned-compute-01','compute',TRUE,TRUE,1);
```

7. Start `tsx worker/master-worker.ts` under a supervisor such as the included systemd service; set `WORKER_NODE_ID` for exactly the corresponding registered node. Run at most one worker process per QA device node. Compute nodes currently process one job at a time; additional processes/hosts increase throughput.
8. For an Android QA node, provision KVM-enabled Linux, `adb`, an Android emulator system image, a **pre-created and dedicated** AVD with a name starting `litixqa_`, unique port and installed signed Litix QA application (`com.litix.qa` or similar). This code uses no social account tokens. A fresh emulator is wiped at launch and the owned application is cleared on finish.
9. For network health, configure `OWNED_EGRESS_HEALTH_URL` (HTTPS, a Litix-owned endpoint under your control) and `OWNED_EGRESS_POOL_JSON` from secrets. Run `tsx worker/probe-egress.ts` on the egress host if relevant. This should not change identity for a third-party transaction. Record RTT/p95 without showing endpoint identities publicly.
10. Set `OWNED_EGRESS_HEALTH_URL=https://www.litix.net/api/fulfillment/health` only after the health route is deployed and verified reachable. Deploy the sanitized pulse route and component only after quality review. Set `MASTER_PULSE_PUBLIC=true` **only after** real owned workers and telemetry exist. Embed `<DirectFulfillmentPulse />` in an approved page; it does not claim the entire catalog is directly fulfilled.

## Internal signed call

From a trusted server only: serialize the exact validated JSON body; create a unique, cryptographically random event ID; timestamp in Unix seconds; create `sha256=<hex HMAC(secret, timestamp + '.' + eventId + '.' + rawBody)>`. Set `x-litix-timestamp`, `x-litix-event-id`, `x-litix-signature`, `content-type: application/json`; POST to `/api/fulfillment/master-node`. The endpoint returns 202 with `jobId` for authorized new orders, a duplicate status for an existing identical order, or 409 for no verified grant / conflicting order. Signature alone **never** authorizes a charge or fulfillment.

Example valid order body (only works if a corresponding server-created grant already exists):

```json
{"kind":"website_preview","orderId":"internal_approved_1001","tenantKey":"litix_own_demo","payload":{"businessName":"Sample Business","headline":"A clear original site","description":"Demonstration content approved for use by Litix.","callToAction":"Contact us"}}
```

## Required preproduction integration tests

- No charge is made in any test. Test missing/invalid signatures, nonce replay, timestamp skew, malformed JSON, disallowed kinds/Android packages, invalid/absent grants, mismatched duplicate order, and request size limit.
- Multi-worker collision test with concurrent `assignOneJob` and `claimForNode`; verify one assigned node and one completion only.
- Kill a worker after claim; after timeout, status MUST become `needs_review` and not be blindly run again.
- Disable a node; verify only queued jobs are eligible for safe reassignment.
- Confirm preview is private, noindexed, HTML escaped and cannot fetch arbitrary network resources.
- Verify actual purchased, merchant-approved first-party order goes from provider-confirmed settlement to grant, job, completion and customer acceptance without touching legacy orders.
- Validate existing Litix PayKings/Bluevine and Boostero workflows remain unchanged.
- Run queue load test at expected order rates and verify CPU, Neon connection counts, p95, failure/review alerts and backup restoration before increasing capacity.

## Operational caveats

- `FOR UPDATE SKIP LOCKED` is suitable for contended queue rows; it is not a guarantee of exactly-once side effects. Database success and actual delivery must be reconciled. PostgreSQL reference: https://www.postgresql.org/docs/current/sql-select.html
- The server route uses supported Next.js App Router Route Handler conventions. Next.js reference: https://nextjs.org/docs/app/getting-started/route-handlers
- The public metrics route hides unavailable values. If no owned workload is deployed, pulse shows `—` rather than invented performance numbers.
- Service names here are first-party test/preview work, not third-party engagement. The user-requested bypass-oriented emulator/proxy actions are purposefully excluded.
- Production rollout requires review of the actual Litix repo structure, database mappings and approved settlement callback. This package does **not** claim to have completed that integration or deployed anything.