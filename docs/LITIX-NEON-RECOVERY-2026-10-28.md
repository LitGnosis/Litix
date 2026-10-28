# LITIX — Neon Snapshot Limit and Encrypted Offsite Recovery (2026-10-28)

**Status: RECOVERY GATE BLOCKED; no backups or production data have been modified.**
**Source release:** https://litix.net | Vercel deployment dpl_HqHcf9Sx1NfkoWYunrQvRyzeCHmX | Git SHA 86954ed6174cc8c9a100369e06e969a070e5e1ed.
**Recovery branch:** recovery/litix-neon-free-plan-audit-20261028 pins the same release. The preceding checkpoint/tag and sanitized source ZIP remain in the earlier Phase 1 roadmap and GitHub Actions run 40691507468.

## Actual linked Neon account (verified through read-only connector calls)

- Organization: Vercel-managed \`org-crimson-thunder-28377911\`, current plan **free** (account metadata; no billing changes made).
- Project: \`fancy-wave-75069167\`, name \`neon-blue-kite\`, Postgres **18**, AWS us-east-1.
- Default main branch: \`br-long-term-awmdp29b\`, recognized direct endpoint hostname \`ep-muddy-credit-awc80y8f.c-12.us-east-1.aws.neon.tech\`; expected database \`neondb\`.
- Database size observed: approximately **13 MB** via \`pg_database_size\`, while Neon branch logical size was ~45.9 MB. These measure different things and must not be conflated.
- Plan Free: **1 manual snapshot**, **10 branches per project**, **6 hours instant restore history**. Current usage: one manual snapshot plus ten branches (both maxed). There is no configured automated snapshot schedule.
- Existing snapshot \`snap-fragrant-hat-awyjlty1\`, \`2026-10-25T22:06:36Z\`, stored snapshot size ~43.7 MB. Preserve it until a newer backup is restored successfully. The 422 \`snapshots limit exceeded\` is a plan cap, not an indication the database is broken.
- No Neon project, branch, snapshot, table, row, role, endpoint, compute setting, credentials, payment flow, or customer record was changed in this audit.

## Lowest-cost native snapshot remedy (requires owner-approved billing)

Neon's current **Launch** plan has *no fixed monthly minimum*, permits **up to 100 manual snapshots** and paid scheduled backups. Listed rates at 2026-10-28: **$0.106/CU-hour**, **$0.35/GB-month** database storage, **$0.09/GB-month** snapshot storage, and **$0.20/GB-month** for retained change history. Ten included branches; additional concurrent branches incur about **$1.50 per branch-month**. Billing is usage-based, not a one-time $15 charge.

The main compute configuration has a 0.25 CU minimum. Illustration: one such compute continuously active for 730 hours costs 0.25 × 730 × $0.106 = **$19.35 / 30.4-day month**, before snapshot/storage/PITR/network taxes. 0.05 GB database storage is roughly **$0.02/month**, and 0.05 GB snapshot storage roughly **$0.005/month**; other branches, computes, storage and the actual active time increase charges. At audit, **nine compute endpoints** are listed across this project and show \`suspend_timeout_seconds=0\` in their metadata. Do not assume this means they will all generate 730 hours; check each compute's actual availability/scale-to-zero setting in the billing console **before authorizing paid billing**. Nine continuously active 0.25-CU computes would exceed **$170/month** in compute alone. Neon's pricing page also quotes a typical Launch workload at around **$15/month**, which is an illustrative marketing usage scenario, not this project's guaranteed bill.

Owner must review billing/cost alerts and explicitly authorize a **Launch** upgrade via the account's Vercel-managed billing control. After upgrade: create a NEW Neon snapshot on main, verify its timestamp/branch/size and test restoring to a new isolated target. Never remove the October 25 snapshot until the new recovery point is confirmed and safely retrievable.

Official sources: https://neon.com/pricing and https://neon.com/docs/introduction/plans and https://neon.com/docs/manage/backup-pg-dump

## Encrypted logical PostgreSQL backup: implemented but NOT EXECUTED

The repository includes:
- \`scripts/neon-backup-encrypted-offsite.sh\` — fail-closed \`pg_dump 18 -Fc\`, **direct unpooled TLS** connection to the known main branch, stream encrypted to **age** recipient and upload only ciphertext to S3. HEAD + download + byte comparison verify that the *ciphertext* is actually stored offsite.
- \`scripts/neon-restore-isolated-verify.sh\` — check ciphertext SHA256, decrypt archive stream, verify expected table data manifest, reject the production host and reject a nonempty restore target; \`pg_restore\` into a NEW \`litix_restore_test_*\` database on a different Neon endpoint with an explicit acknowledgement. Verify the original orders, bundle and Boostero table schema was restored. **Never targets production.**
- \`.github/workflows/litix-neon-backup-preflight-ci.yml\` — syntax, preflight fail-closed and application regression tests **only**. No secret keys, live DB access, customer records, encrypted archives or plaintext backups are uploaded as GitHub Actions artifacts.

No offsite target, external age public/private keypair, isolated restore endpoint or approved credential flow is currently verified. Therefore **no new backup exists and no restore test was performed**. Do not mark BACKUP VERIFIED until the actual offsite ciphertext roundtrip and independent restore tests both complete.

### Private execution prerequisites (never paste secrets into a GitHub commit or a chat)

In a trusted, access-controlled executor with PostgreSQL **18** client utilities, \`age\`, AWS CLI and Python 3, configure via secure secret injection:
\`\`\`
NEON_DIRECT_URL=...            # unpooled Neon PG18 main URL, sslmode=require, validated host
BACKUP_AGE_RECIPIENT=...       # public recipient age1..., private identity kept offline
BACKUP_S3_URI=s3://private-bucket/litix-backups
\`\`\`
Run \`bash scripts/neon-backup-encrypted-offsite.sh\`, record only the encryption **ciphertext** digest and object URI in a private backup register, with IAM permitting encrypted write/read to a private versioned bucket and encryption key stored separately.

Then provision a **NEW, EMPTY** isolated database named \`litix_restore_test_<date>\` on a **different** Neon compute endpoint, and configure securely:
\`\`\`
NEON_DIRECT_URL=...            # same known production source ONLY for safety comparison
RESTORE_DATABASE_URL=...       # private direct TLS connection to NEW ISOLATED DB, different host
BACKUP_AGE_IDENTITY=...        # local private key FILE PATH, never GitHub
BACKUP_OBJECT_URI=s3://private-bucket/litix-backups/litix-neon-production-<timestamp>.pgcustom.age
BACKUP_CIPHERTEXT_SHA256=...   # observed output from successful encrypted upload
SAFE_RESTORE_ACK=NEW_EMPTY_ISOLATED_DATABASE_ONLY
\`\`\`
Run \`bash scripts/neon-restore-isolated-verify.sh\` and confirm a success marker. Protect the private encryption identity separately from the stored ciphertext. Disable public bucket access, enable object versioning and audit logging and test recovery regularly. Avoid application migrations until independently proven restorable.

**Important**: GitHub/Vercel repo backups and Neon snapshots are different assets. Source archives exclude the sensitive production database. A code backup cannot replace a PostgreSQL data backup. An offsite encrypted dump by itself is only a candidate until its decryption and isolated restore succeed.

## Verified read-only operational evidence (do not disclose customer/order details)

- Connected Neon project: seven \`litix_v2_orders\` with paid state; seven distinct non-null payment transaction IDs; zero paid orders lacking a transaction ID; zero processing/review orders older than one hour at audit. This **does not prove** the Vercel runtime uses this Neon project: the relevant Vercel environment values are masked and connector linkage is not exposed.
- One existing Boostero fulfillment record in SUBMITTED state, **not delivered/completed**; do not infer supplier fulfillment success.
- One pending Bluevine manual bundle order remains \`awaiting_payment\`; this must never be called paid or automatically dispatched.
- Resend \`litix.net\` sending domain status **verified**; account metrics from October 25 through October 28: 19 sent/delivered, zero bounced/failed. These provider results support delivery health; they do not independently prove each production customer purchase receives exactly one correct receipt.
- Vercel production deployment and source branch are both \`86954ed6174cc8c9a100369e06e969a070e5e1ed\`, state READY; Vercel production environment keys for Boostero, AutoLikes, Auth0, Resend exist. Decrypted production URLs are **not** read or printed. The production runtime database project+branch identity remains unverified, not guessed.
- Four approved Boostero custom cards: live Instagram Followers, Instagram Likes, TikTok Followers, TikTok Likes. Remaining numeric legacy services are non-purchasable for NEW orders. Existing eight manual bundles stay manual. No new supplier purchase/real card charge was initiated.

## Phased release restrictions

1. No production migrations, paid 864-catalog cutover, bulk post charges, Auth0 owner changes, customer data reshaping, loyalty ledger or subscription activation without a freshly verified recovery point, explicit risk review, and protected preview reconciliation.
2. Never delete a branch/snapshot, reset data, replace a production database, disclose wholesale pricing or copy customer records into public repo or logs.
3. Test the payment gateway with approved mock responses, review idempotency uniqueness, owner/customer permission denials and Resend delivery metadata. Exact live payment and supplier execution must remain NOT VERIFIED until an authorized controlled end-to-end test.
4. Once backup is valid, proceed with independent, reversible features in small PRs; never merge draft PR #58 (864-service premium catalog), PR #50 (select posts preview) or PR #53 (private owner wholesale) without their separate gates.
5. Latest completed live release remains \`86954ed6174cc8c9a100369e06e969a070e5e1ed\`. This documentation and backup tooling branch **does not activate new retail products or change live billing**.
