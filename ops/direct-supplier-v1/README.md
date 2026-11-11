# Litix Direct Supplier V1 — staging release candidate

This is a single **review-only** first-party wholesale and agency SaaS expansion. No reseller SMM provider is called by this subsystem. Existing Litix customer transactions and legacy systems are intentionally unchanged.

## Components and directory

- `db/007_direct_revenue.sql`: additive, idempotent Neon schema including `growth_ops.child_panels`, `growth_ops.agency_retainers`, `growth_ops.affiliate_ledger`, payment-event ledgers, first-party job receipts, wallet records, and disabled release gates.
- `backend/api.py`: FastAPI internal applications, payment events, independently reconciled NMI settlements, child panel credentials, agency handles, and node API.
- `backend/nmi.py`: PayKings/NMI signature validation and read-only merchant Query API settlement checks.
- `backend/node_api.py`: Ed25519 signed first-party node heartbeat, leasing, receipts and owner-approved observations.
- `backend/fulfillment_worker.py`: authenticated post-observation poller at 60 seconds, durable outbox publisher, TLS Redis stream dispatcher, lease recovery.
- `backend/owned_node_agent.py`: signed first-party execution agent for Litix-created content and owner-authorized observations.
- `src/app/wholesale`, `src/app/agency`, `src/app/ai-content-studio`: responsive public landing/interactive enrollment pages and editable content-media prompts.
- `src/app/api/direct-plans`: Next.js back-for-frontend preventing browser exposure of internal tokens.

## Backend deployment / Railway

Use three independent Railway services from the same repository, **root** `/ops/direct-supplier-v1`:

1. **litix-direct-api** — Dockerfile `Dockerfile.api`, HTTP port 8080, private network or ingress with signed callbacks only.
2. **litix-direct-router** — Dockerfile `Dockerfile.worker`, persistent process.
3. **litix-direct-owned-agent** — Dockerfile `Dockerfile.node`, dedicated first-party node with its own Ed25519 private key and *no reseller credentials*.

Railway services must use `DATABASE_URL=postgresql://...` (separate restricted role per service), `REDIS_URL=rediss://...` (authenticated TLS), and a trusted CA where applicable. Never store key material in the repository, browser bundle, logs or PR comments.

Additional API environment secrets: `LITIX_INTERNAL_SERVICE_TOKEN` (>=32 random characters), `LITIX_NMI_WEBHOOK_SIGNING_KEY`, `LITIX_NMI_MERCHANT_ID`, `LITIX_NMI_QUERY_SECURITY_KEY`, `LITIX_NMI_ACCOUNT_CURRENCY=USD`, `LITIX_API_KEY_WRAP_KEY_B64` (32 random bytes, base64), `LITIX_AUTH0_ISSUER`, `LITIX_AUTH0_AUDIENCE`. The Node service additionally requires `LITIX_DIRECT_BACKEND_URL`, `LITIX_DIRECT_NODE_NAME`, and `LITIX_DIRECT_NODE_ED25519_KEY_B64`. Router requires `LITIX_DIRECT_WORKER_ENABLED=true`. Production recurring checkout additionally needs an approved NMI hosted recurring plan checkout URL for each tier; do not enable by inventing links.

Next.js requires server-only `LITIX_DIRECT_API_URL`, `LITIX_INTERNAL_SERVICE_TOKEN`, optional `LITIX_NMI_HOSTED_PANEL_PLAN_URL`, `LITIX_NMI_HOSTED_AGENCY_500_URL`, `LITIX_NMI_HOSTED_AGENCY_1500_URL`, and `LITIX_DIRECT_RECURRING_CHECKOUT_ENABLED=false` until full release clearance.

**Production release gate:** `growth_ops.direct_release_gates` must remain false until all conditions are proven. The observed no-charge PR183 webhook-to-Litix-owned creative deliverable is not a real PayKings merchant settlement or evidence of genuine platform interactions.

## Migration and validation

Apply `db/007_direct_revenue.sql` first on a Neon isolated/staging branch. It was applied successfully to the existing staging branch in this review and did not modify production. Re-run to prove idempotency, inspect schemas and constraints. Before production migration, create a verified backup and obtain approval.

CI: `.github/workflows/litix-direct-supplier-review.yml` compiles Python, runs signature/money/Ed25519 tests, scans for any third-party SMM provider calls, and runs full Next.js production build.

## Direct-only delivery semantics

`first_party_nodes` is an **owned node registry**, not proof that a device is capable of genuine engagement. The dispatcher requires a fresh heartbeat and an enabled public-key registration. A node must be explicitly approved through the internal node-enablement endpoint with its verified key fingerprint. It then signs all receipts with Ed25519. Database job completion and evidenced artifact output are separate from any platform views/likes/follows. The system never interprets queue acceptance as such engagement.

The 60-second poller handles **owner-authenticated, explicitly verified post observations**. It does not discover arbitrary social posts, create fake streams, or publish to accounts without permission. A future platform-authorized owned connector can publish observations through `/v1/observations`; until then the feature stays disabled.

## Revenue assumptions

Proposed (not live) plans: child panel **$149 per week**, agencies **$500 per week/25 handles**, enterprise **$1,500 per week/100 handles**. A 20% commission is an accrued, pending ledger entry, **not automatic cash payout**. No $10,000/week earnings are promised. All plans need capacity validation, approved NMI merchant pricing/recurring subscriptions, accounting review, and completed payment reconciliation.

## Rollback

Leave the public gateway disabled and revert the PR deployment to the prior known-good Vercel version. Stop only the three new Railway services. New additive tables can remain for auditability; never delete historical payments, live jobs, secrets, or customer records as a rollback step. Preserve signed webhook events for reconciliation.
