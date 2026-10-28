# Litix — Private Cloudflare R2 recovery activation (2026-10-28)

**Status: NOT a production backup. This is a prepared, tested recovery method. Never mark complete until BOTH real application databases are restored from encrypted offsite objects.**

## Verified, currently authorized infrastructure
- Vercel production: `dpl_HqHcf9Sx1NfkoWYunrQvRyzeCHmX`, READY at `86954ed6174cc8c9a100369e06e969a070e5e1ed` (customer runtime unchanged).
- GitHub protected source checkpoint: `recovery/litix-r2-backup-prep-20261028` at `97ab83a6c1e11b75164481ffc43fd9b6098bf857`. Original October 25 Neon snapshot `snap-fragrant-hat-awyjlty1` remains preserved.
- Neon main branch Free, one old snapshot/one available, 10 of 10 branches; no free new snapshot capacity. Neon branchable object storage is enabled but shows zero buckets and is NOT independent of the database provider.
- The Vercel project has **no** connected external storage connector or verified R2/AWS backup environment variables in its existing production scope.
- `LitGnosis/Litix` is a PUBLIC GitHub repository; no real backup dump, key, customer data, R2 credential, connection URL or encrypted production archive may be committed or uploaded as its Actions artifact.
- Neon application databases observed by read-only queries: `neondb` 13,803,520 bytes; `litixapi` 8,101,888 bytes. Both have application tables. Two encrypted offsite archives and two independent restores are required.

## Why Cloudflare R2 and what it costs
- Cloudflare R2 **Standard** free monthly included allowance: 10 GB-month, 1,000,000 Class A operations and 10,000,000 Class B operations; no internet egress fees. These two small databases are well below the storage free allowance, but cumulative retention and operations must be monitored.
- Creating/using R2 requires an R2 subscription activation/checkout in Cloudflare; included free usage does not mean billing can never occur. **Do not activate R2 billing, add a payment method, or approve any charge without the owner's specific consent.** No Cloudflare R2 account connection is available in current ChatGPT tools.
- Official source: https://developers.cloudflare.com/r2/pricing/ and https://developers.cloudflare.com/r2/get-started/ and https://developers.cloudflare.com/r2/get-started/s3/

## Owner actions only — performed in Cloudflare directly
1. Sign in at https://dash.cloudflare.com/ and choose the intended existing account.
2. Go to **Storage & databases → R2 → Overview**. If R2 requires subscription checkout or a payment method, review the terms and stop to approve billing separately. Do not assume the free tier eliminates all possible charges.
3. Once R2 is authorized, create a bucket (suggestion: `litix-neon-private-backups`), **Standard** storage class. Do not attach an r2.dev public development URL, public custom domain, or a public Worker endpoint.
4. In the bucket's settings, verify **no public access**; retain this check when testing. Enable object versioning or protected retention if provided at no cost, subject to account availability, and keep more than one separately verified restore point.
5. Go to **R2 → Overview → Manage R2 API tokens → Create API token**. Create an **Object Read & Write** token restricted to the backup bucket. Store its access key ID and secret in a secure personal password manager or local secret store, **never paste in ChatGPT, Vercel public source, GitHub or logs**.
6. Record only the non-secret **R2 account ID, bucket name and region** and the canonical endpoint `https://<32-character-account-id>.r2.cloudflarestorage.com`. These are necessary for the S3-compatible AWS CLI.

## Owner-controlled age encryption identity
On a trusted local computer with the `age` command installed, generate the private identity OFFLINE:
```sh
umask 077
age-keygen -o /secure/offline/location/litix-r2.agekey
age-keygen -y /secure/offline/location/litix-r2.agekey
```
Keep the private `.agekey` file offline, backed up independently; use only the printed `age1...` public recipient on the backup runner. **Never upload the private age identity to any storage provider, GitHub, this chat, or a CI job.** If the private key is lost, ciphertext cannot be restored.

## Trusted execution environment (not GitHub's PUBLIC Actions)
The reviewed scripts are `scripts/neon-backup-encrypted-offsite.sh` and `scripts/neon-restore-isolated-verify.sh`. Use a trusted isolated machine with PostgreSQL 18 tools, `age`, Python 3 and AWS CLI. Supply all secret values using a private process environment or secret manager, with shell tracing **OFF**, no debug logs and no screenshots.

Secret-setting names (the values must NOT be committed):
```dotenv
BACKUP_STORAGE_PROVIDER=r2
BACKUP_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
BACKUP_R2_PRIVATE_BUCKET_CONFIRMED=I_VERIFIED_NO_PUBLIC_ACCESS
BACKUP_S3_URI=s3://litix-neon-private-backups/litix-production
AWS_ACCESS_KEY_ID=<private-r2-bucket-scoped-access-id>
AWS_SECRET_ACCESS_KEY=<private-r2-bucket-scoped-secret>
BACKUP_AGE_RECIPIENT=age1...
NEON_EXPECTED_SOURCE_HOST=<verified-direct-main-Neon-host>
NEON_BACKUP_DATABASE=neondb
NEON_DIRECT_URL=<private-direct-postgres-18-neondb-url-with-sslmode-require>
```
Run the backup script once for `neondb`. Repeat with `NEON_BACKUP_DATABASE=litixapi` and the corresponding direct URL; this creates a **different encrypted object**. Do not use Neon pooler URLs.

Each execution confirms an encrypted file uploaded to Cloudflare R2, reads its object metadata and downloads it again, comparing all ciphertext bytes; expected success marker: `ENCRYPTED_OFFSITE_COPY_VERIFIED`, database name and SHA256. This proves storage integrity, *not yet data recovery*.

## Isolated database restore verification

The default Neon Free project has 10/10 branches. Do NOT delete a branch or modify production to create an extra test environment. Prefer a separate available disposable Postgres 18 target, on a distinct host with a **new empty database** named `litix_restore_test_neondb_<date>` or `litix_restore_test_litixapi_<date>`, and explicitly approve that temporary resource/host.

The current restore safety script accepts only a **different unpooled `.neon.tech` endpoint**, not localhost or production; an existing authorized NONPRODUCTION Neon branch with empty, separately named databases may work if explicitly checked, but no such target is pre-provisioned here. Otherwise adapt and revalidate the strict isolation guard in a separate PR before testing a local container with actual production data.

Set privately for each independent restore:
```dotenv
BACKUP_STORAGE_PROVIDER=r2
BACKUP_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
BACKUP_R2_PRIVATE_BUCKET_CONFIRMED=I_VERIFIED_NO_PUBLIC_ACCESS
AWS_ACCESS_KEY_ID=<private-key>
AWS_SECRET_ACCESS_KEY=<private-secret>
NEON_EXPECTED_SOURCE_HOST=<verified-production-direct-host>
NEON_BACKUP_DATABASE=neondb
NEON_DIRECT_URL=<same-source-only-for-comparison>
RESTORE_DATABASE_URL=<NEW_EMPTY_DIFFERENT_HOST_DB_named_litix_restore_test_neondb_date>
BACKUP_AGE_IDENTITY=/secure/offline/location/litix-r2.agekey
BACKUP_OBJECT_URI=s3://litix-neon-private-backups/litix-production/<encrypted-neondb-object>
BACKUP_CIPHERTEXT_SHA256=<observed-ciphertext-sha256>
SAFE_RESTORE_ACK=NEW_EMPTY_ISOLATED_DATABASE_ONLY
```
Run `bash scripts/neon-restore-isolated-verify.sh` and repeat for `litixapi`. The script refuses a production host or a pre-populated database and verifies restore manifests and core table presence. Check row-count parity, unique keys, triggers and critical data relationships in the isolated environment **without printing customer content**. No web-accessible restore host and no real application traffic should reach the test target.

**Successful backup = BOTH actual encrypted uploads and BOTH separately restored/validated databases, plus custody of private age identity.** Do not call synthetic CI runs an actual backup.

## Parallel, non-production development allowed
- Build and inspect PR #58 (864 services) with mock catalog compatibility and prices, but keep its `purchasingEnabled:false` gate.
- Build and inspect PR #50 Select Your Post with `paymentReady:false` until authorized API+checkout+ledger tests pass.
- Develop account, loyalty, subscriptions, agency isolation and international checkout mock tests on isolated branches only. No database migrations, supplier submissions, payment changes or production release before actual fresh, independently restorable backups.
- Historical SMMGLOB records remain available for audit; Boostero remains the only supplier for NEW orders. Do not change current retail prices or metallic platinum branding.

## Evidence/limits
- Existing synthetic-only PostgreSQL 18 + age + restore CI passed for both databases (PR #68).
- Actual R2 account, token, private bucket, key custody and isolated restore target are NOT available in current connected tools. **No customer data export or new R2 subscription has been attempted.**

## Optional zero-Neon-branch restore: trusted local Docker

Instead of creating a new Neon branch (the project already has ten), a more cost-conscious restore can run **entirely on the owner's trusted local machine** via `scripts/neon-restore-local-docker-r2.sh`, provided it has a genuinely local Unix-socket Docker daemon. The container uses PostgreSQL 18, `--network none`, no published ports or host data volumes, a disposable database and guaranteed cleanup. The encrypted archive is downloaded from R2, SHA256 verified, decrypted as a stream directly into the isolated container and checked for expected core tables and readable rows. No plaintext production backup is written to host disk.

**Prerequisites:** locally installed Docker, `age`, AWS CLI, Python 3, actual owner-controlled private decryption identity (never ChatGPT), private R2 bucket-scoped access, and encrypted production backups for both `neondb` and `litixapi`. Use the same non-secret/private R2 settings and `BACKUP_OBJECT_URI` and `BACKUP_CIPHERTEXT_SHA256` from the upload steps above; also set `RESTORE_LOCAL_DOCKER_ACK=I_APPROVE_OFFLINE_DOCKER_RESTORE`. Run `bash scripts/neon-restore-local-docker-r2.sh` **once per database**, selecting the corresponding `NEON_BACKUP_DATABASE`. Expected success messages include `LOCAL_OFFLINE_POSTGRES18_ENCRYPTED_RESTORE_VERIFIED`, `RESTORED_DATABASE=<selected database>`, `NO_PRODUCTION_DATABASE_CONNECTION_OR_PORT_EXPOSED`.

Local restore transfers decrypted customer data into a locally isolated container while the test runs; use a physically trusted machine with encrypted local disks and no remote Docker daemon, take care of local access and audit requirements, and do not save stdout/screenshots containing records. The script refuses remote Docker contexts but **cannot independently attest the physical security of a user's device**. Do not use on shared machines.

A synthetic CI demonstration, `scripts/test-neon-local-r2-restore-synthetic.sh`, verifies the same workflow using **fake records and a fake AWS CLI**; the synthetic test cannot substitute for actual independent restoration of current production data.

This local method avoids purchasing or deleting Neon staging branches. It does **not** circumvent the requirement for a real private Cloudflare R2 account, bucket, valid credentials, owner-held age key or successful recovery of both real databases.

## Owner-controlled one-command `age` key bootstrap

`scripts/litix-owner-age-keygen-local.sh` must be run **on the owner's own trusted Mac/Linux/WSL computer**, never in ChatGPT, Vercel, public GitHub Actions or a shared shell. Install the official open-source `age` utility locally first, and use the reviewed script from this repository:

```sh
bash scripts/litix-owner-age-keygen-local.sh
```

The script uses strict permissions (700 private directory, 600 identity), refuses existing keys and Git-tracked locations, and writes to the owner-only default path `~/.config/litix-backup/litix-r2-age-identity.txt`. It prints **only** the public `age1...` recipient and local file path, not the private key. Keep a separately encrypted, offline owner-controlled copy of the identity; never move it into R2, GitHub, ChatGPT, screenshots or deployment logs. A synthetic GitHub Actions test creates only temporary throwaway keys to validate file permissions and no-overwrite behavior; **that test does not generate or store the owner's actual key**.

### Cloudflare R2 billing gate and jurisdiction

Cloudflare requires an R2 subscription activation to enable bucket/token management, despite included free Standard usage. If the dashboard prompts for billing acceptance or payment details, the owner must separately approve that before activation. Choose Standard storage and the default jurisdiction unless a different jurisdiction was intentionally selected and the endpoint validators were updated to match; the prepared scripts currently accept `https://<32 hex chars>.r2.cloudflarestorage.com` and fail closed for jurisdiction-specific endpoints.

Current official documentation:
- https://developers.cloudflare.com/r2/get-started/
- https://developers.cloudflare.com/r2/api/tokens/
- https://developers.cloudflare.com/r2/pricing/

R2 token: **Object Read & Write**, **selected private bucket only**. Keep public development access, public custom domain and public Workers disabled. Do not store backup keys in the live Litix storefront environment unless a dedicated secret-managed backup runner and its access rules are separately reviewed.
