# Litix Native Content Fulfillment — owned technology, no Butter app

**Purpose.** Implement an original Litix-operated content-production and service work-order layer, using the architecture seen in the owner-provided Butter video as inspiration. This repository does **not** contain or claim access to Butter's proprietary source or any third-party account farm.

## What this branch actually builds

1. **Audited work-order technology.** A dedicated PostgreSQL ledger for paid, client-authorized content variation, social publishing work, UGC production and reporting. Every order is staged idempotently as **DRAFT**. Database triggers reject forbidden state changes and preserve immutable change events.
2. **Owner-only control API.** `/api/internal/native-fulfillment`, protected by a dedicated 32+ character bearer token and a default-off feature flag. Supports staging, approving a documented operator, starting work, putting work in review, resuming, cancelling drafts, and completing only with HTTPS delivery evidence.
3. **Real content-processing worker.** Local, standalone FFmpeg process producing **three original 9:16 MP4 variations** (clean, warm, bold) from source files for which Litix has rights. No third-party automation software needed.
4. **No-charge tests and CI** for state-machine gates, HTTPS checks, idempotency, media output, and the fact that the internal API cannot charge money or call a supplier.

This implementation does not automatically publish via Instagram/TikTok and **does not manufacture likes, followers or views**. It does not connect an external supply account or submit a live order. OAuth posting adapters and a staffed, verified provider network must be integrated separately under the relevant platform permissions. It is a first working layer, **not** a finished full-scale Butter clone.

## Why it is intentionally isolated

- Existing quantity-priced SMM services stay exclusively with the currently approved Boostero integration.
- Production issue [#167](https://github.com/LitGnosis/Litix/issues/167) still has unresolved historical paid-order, multi-post and payment-outbox reconciliation. Those orders must never be ingested into this system, retried or interpreted as newly paid.
- Some source files still show old SMMFOLLOWOM integrations and `/api/checkout` fail-closed. Before deployment the team **must confirm the exact production project/source root**. Do not deploy this experimental branch over the stable production alias or reactivate legacy suppliers.
- No new public SKUs, prices, automatic supplier routing, OAuth permissions, or payment actions are enabled by merging the code alone.

## Files

- `src/native/fulfillment-core.mjs`: human/legitimate-content service types, strict validation, deterministic fingerprinting, constant-time token comparison, and transition guard.
- `src/native/repurpose-video.mjs`: FFmpeg conversion utility. Runs on a machine/worker with FFmpeg installed, **not** in a short-lived Vercel function.
- `src/db/migrations/20261110-native-content-work-orders.sql`: independent audit tables; requires an explicit, reviewed database migration.
- `src/app/api/internal/native-fulfillment/route.js`: admin-only management endpoint, default disabled.
- `src/tests/native-fulfillment.test.mjs`: local tests and no-charge FFmpeg smoke test.
- `.github/workflows/native-content-fulfillment.yml`: scoped GitHub CI.

## Local tests (no payment/supplier traffic)

```bash
node --test src/tests/native-fulfillment.test.mjs
node --check src/app/api/internal/native-fulfillment/route.js
```

Requires Node.js 22 for recommended CI. The local video test skips actual FFmpeg output if FFmpeg is not installed.

## Produce a real video variant set

```bash
node src/native/repurpose-video.mjs /path/to/authorized-clip.mp4 /path/to/variants --client-authorized
```

The source file must be an existing MP4/MOV/WebM file (up to 1 GB), and the operator must have valid content rights/client approval. The worker produces `__clean.mp4`, `__warm.mp4`, and `__bold.mp4`. It does **not** access social passwords, impersonate creators, publish to platform accounts, charge clients or simulate engagement. Use a separate persistent worker/compute for long videos and storage.

## API activation (deliberately OFF)

Only after a reviewed PR, CI and production source verification:

1. Back up the correct **production** Neon database; validate migration on a branch first.
2. Apply `src/db/migrations/20261110-native-content-work-orders.sql` to the approved schema.
3. Set `LITIX_NATIVE_FULFILLMENT_ADMIN_TOKEN` to a unique secret of 32+ characters using Vercel secret storage; **never** commit or echo it.
4. Set `LITIX_NATIVE_FULFILLMENT_ENABLED=true` only after a no-charge staging and RBAC review. Default is disabled.
5. Permit the endpoint only to authorized server-side staff tooling, not the storefront. Do not embed the token in client JS.
6. Add rate limiting, telemetry, staff roles, backups, and explicit operator agreements before making content work-order submissions publicly purchasable.

Example staged command (requires an already-settled existing PayKings order and enabled admin API):

```bash
curl -X POST 'https://www.litix.net/api/internal/native-fulfillment' \
  -H "Authorization: Bearer $LITIX_NATIVE_FULFILLMENT_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{
    "action":"stage",
    "sourceOrderId":"replace_with_real_settled_order_id",
    "spec":{
      "kind":"CONTENT_VARIATION",
      "platform":"INSTAGRAM",
      "brief":"Create three vertical video edits from authorized client content",
      "sourceAssetUrl":"https://cdn.example.com/authorized-video.mp4",
      "deliverables":3,
      "clientAuthorized":true
    }
  }'
```

This only creates an idempotent **DRAFT**. It does not dispatch to Butter, Boostero or an operator; it does not create or retry a card payment. The source order's payment_state must be `settled`, USD, with a recorded settlement timestamp in the connected checkout ledger. A valid payment is required but is **not** by itself proof that the buyer purchased a newly approved content SKU; staff must separately review scope and consumer consent.

### Operator state transitions

- `stage`: paid source validation + customer authorization → `DRAFT`.
- `approve`: independent scope/consent review, documented `operatorReference` and `approvalReference` → `READY_FOR_OPERATOR`.
- `start`: operator accepts job → `IN_PROGRESS`.
- `review`: unresolved delivery/quality → `REVIEW_REQUIRED`.
- `resume`: after documented investigation → `IN_PROGRESS`.
- `complete`: evidenceUrl → `DELIVERED`.
- `cancel`: only a `DRAFT` may be cancelled through current API; cancellations are not refunds.

All transitions are operator-owned and auditable. Neither the customer nor any outbound supplier can claim completion by submitting unauthenticated requests. The API does not provide an automated provider-dispatch path because such a claim would be false without documented supplier authorization and an API.

## Next technical milestones for a full owned multi-account platform

- Account workspace management: register only verified client-controlled accounts using official OAuth scopes, consent expiry, token encryption/rotation and per-client isolation.
- Asset library and transformation queue: persist authorized source videos and process variants using a dedicated worker with object storage and a retry/DLQ policy.
- Official publishing adapters: implement platform-supported posting APIs and post IDs where connected/eligible; otherwise use manual approval. Never promise API access or bypass restrictions for every account.
- Provider work-order adapter: verified human creator/UGC or agency partners with signed terms, quoted capacity, immutable event trail, approval and refund logic.
- Customer tracking: only mark `DELIVERED` after actual post URL or operator evidence; separate platform analytics from purchased SMM quantity metrics.
- Incident gates: prevent any new supplier or payment replay while historical PayKings/Boostero incident #167 is unresolved.

**No production deployment or live order routing is performed by this branch.**
