# Litix — owner-local Cloudflare R2 connection and actual backup execution

Date: 2026-10-28. **NO real production R2 backup has yet been verified.**

## Verified execution architecture
Production backup runner is the OWNER'S TRUSTED LOCAL COMPUTER, not GitHub Actions. `scripts/litix-owner-run-r2-backup-and-verify.sh` calls the encrypted pg_dump and local network-isolated Docker restore scripts. GitHub Actions uses synthetic data and mocks only. `LitGnosis/Litix` is PUBLIC; real customer dumps, actual private age keys and production R2/Neon secrets must never go into workflow artifacts, GitHub files or live Vercel storefront config.

Owner supplied R2 private bucket `litix-private-backups`, Object Read & Write bucket-scoped token, disabled public access, token expiry 2027-04-28. These are owner assertions, not an R2 API verification in this chat. `AWS_DEFAULT_REGION=auto` and R2 account-specific HTTPS S3 endpoint are required.

## Step 1. Save R2 credentials on your trusted machine, not ChatGPT or GitHub
Install AWS CLI v2 on your trusted Mac/Linux/WSL computer with full-disk encryption. In your own Terminal run:
```sh
aws configure --profile litix-r2-backup
```
Enter the Access Key ID and Secret Access Key from YOUR password manager directly into the local AWS CLI prompts, choose region `auto`, output `json`. AWS CLI credentials are stored in a local file (not a hardware keychain); protect the device and permissions. For stronger protection inject credentials from a dedicated local secret manager instead.
```sh
chmod 700 "$HOME/.aws"
chmod 600 "$HOME/.aws/credentials"
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
export AWS_PROFILE=litix-r2-backup
```
Repository-level Actions secrets at https://github.com/LitGnosis/Litix/settings/secrets/actions are NOT consumed by the production backup. If already created, consider removing unused duplicate copies after verifying secure local custody. Do not paste secrets in this chat.

## Step 2. Harmless actual R2 connectivity check
Find the Cloudflare Account ID in the R2 Overview dashboard. Run on your OWN machine:
```sh
export R2_ENDPOINT='https://<YOUR-32-HEX-ACCOUNT-ID>.r2.cloudflarestorage.com'
export R2_BUCKET=litix-private-backups
export R2_PRIVATE_BUCKET_CONFIRMED=I_VERIFIED_NO_PUBLIC_ACCESS
bash scripts/litix-r2-test-connection-local.sh
```
Expected marker: `R2_PRIVATE_BUCKET_PUT_HEAD_GET_DELETE_VERIFIED` and `NO_CUSTOMER_DATA_ACCESSED`.
The script uploads a cryptographically unique 128-byte harmless object, verifies HeadObject/GetObject and a downloaded SHA256, then deletes ONLY the temporary object. It makes no Neon or customer data requests. If it reports temporary object cleanup failure, delete the exact `litix-readiness-probes/` test object shown in the error through Cloudflare.

## Step 3. Owner-only age encryption identity
Install age locally. Run once:
```sh
bash scripts/litix-owner-age-keygen-local.sh
```
Keep `~/.config/litix-backup/litix-r2-age-identity.txt` offline with an encrypted separate recovery copy; only the printed `age1...` public recipient is used for encryption. The private identity is never placed in this repository, ChatGPT, GitHub Actions or Cloudflare.

## Step 4. Real, read-only production encrypted export and isolated restore
Use a trusted owner-local computer with PostgreSQL 18 `pg_dump`, `age`, AWS CLI, Python 3 and a strictly local Docker daemon. Get BOTH direct PostgreSQL main-branch TLS URLs (`neondb` and `litixapi`) from your private Neon settings. Inject URL values using a local secrets manager—not shell history, this chat, or GitHub.
```sh
export BACKUP_STORAGE_PROVIDER=r2
export BACKUP_S3_ENDPOINT_URL="$R2_ENDPOINT"
export BACKUP_S3_URI=s3://litix-private-backups/litix-production
export BACKUP_R2_PRIVATE_BUCKET_CONFIRMED=I_VERIFIED_NO_PUBLIC_ACCESS
export BACKUP_AGE_IDENTITY="$HOME/.config/litix-backup/litix-r2-age-identity.txt"
export BACKUP_AGE_RECIPIENT="$(age-keygen -y "$BACKUP_AGE_IDENTITY")"
export NEON_EXPECTED_SOURCE_HOST='<TRUSTED-DIRECT-NEON-MAIN-HOST>'
# Provide these TWO private environment variables via your local secrets manager:
# LITIX_NEON_DIRECT_URL_NEONDB  -> direct TLS main/neondb, sslmode=require
# LITIX_NEON_DIRECT_URL_LITIXAPI -> direct TLS main/litixapi, sslmode=require
export LITIX_R2_BACKUP_OWNER_ACK=I_APPROVE_ENCRYPTED_EXPORT_AND_ISOLATED_RESTORE
bash scripts/litix-owner-run-r2-backup-and-verify.sh
```
The orchestrator checks the public recipient against your private age identity BEFORE any source export, locks the destination to the approved private R2 bucket, validates source URLs, then creates TWO separate encrypted PostgreSQL custom archives, downloads ciphertext for integrity verification and restores EACH in disposable no-network Docker PostgreSQL 18. It does not run database migrations. The October 25 snapshot, PayKings, Auth0, Boostero, Resend and Vercel production remain unchanged.

Only a real run producing the overall marker `LITIX_BOTH_PRODUCTION_DATABASES_ENCRYPTED_OFFSITE_AND_RESTORED_VERIFIED` establishes this particular backup run's success. A synthetic GitHub Actions run is not proof of actual customer-data restoration. Additionally reconcile original/restored table counts and database source identity before risky schema work. Source app roles/grants may require a separate controlled globals strategy (`pg_dump --no-owner --no-acl` does not preserve roles).

## Exact blockers and retention
- ChatGPT/GitHub plugin cannot access the Cloudflare R2 account, read GitHub Actions secrets, retrieve owner private age identity, or launch a secure process on the owner's computer.
- Source DB identity mapping to live Vercel runtime is not independently verified. Do not infer it from a masked environment variable.
- No actual R2 object upload or restoration happened in this ChatGPT session. Tests use fake AWS stubs and synthetic records only.
- Owner R2 token expires April 28, 2027: rotate before that date.

Official references: https://developers.cloudflare.com/r2/get-started/s3/ and https://developers.cloudflare.com/r2/examples/aws/aws-cli/
