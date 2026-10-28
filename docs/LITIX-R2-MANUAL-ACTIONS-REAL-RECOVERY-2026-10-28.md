# LITIX — Manual GitHub Actions verification of REAL R2 and Neon backups

2026-10-28. **No real R2 credential test, Neon export, or real restore has run from this workflow yet.**

## Why GitHub Actions was selected
The actual owner-local backup scripts remain unchanged and safe. This is an ADDITIONAL manually authorized, secret-protected GitHub runner because the connected assistant has no access to the user's Cloudflare credentials, private machine, GitHub Actions secret values, or the GitHub workflow-dispatch API. `LitGnosis/Litix` is a PUBLIC repository; Actions job logs are public. No plaintext database archive, customer content, payment information or credentials may appear in those logs/artifacts. Real customer data temporarily enters a hosted GitHub ephemeral runner for the isolated restore, so an owner who does NOT consent to that must use the existing trusted LOCAL backup process instead.

## Required GitHub setup — owner action, never chat
Open https://github.com/LitGnosis/Litix/settings/environments and create the protected environment `litix-private-backup`. Configure **required reviewers** for deliberate approval before environment secrets are released. Keep environment deployment branches limited to `main` if available. Do not configure this environment for PR/test runs. The manual workflow runs only on `refs/heads/main` and checks the repository name.

Add or confirm the following **exact eight secret names** in this environment under **Environment secrets**. Alternatively, matching Repository Actions secrets resolve with `secrets.*`, but environment-scoped secrets are recommended for a public repository. The connected GitHub API cannot inspect the current list or secret contents; NONE of these may be claimed present until you review Settings.

| Secret name | What to enter directly into GitHub settings |
|---|---|
| `R2_ACCESS_KEY_ID` | Bucket-scoped Cloudflare R2 S3 Access Key ID; Object Read & Write for `litix-private-backups` |
| `R2_SECRET_ACCESS_KEY` | Matching R2 S3 Secret Access Key, stored securely; never paste into chat |
| `R2_ENDPOINT` | `https://<32-hex-Cloudflare-account-id>.r2.cloudflarestorage.com` (the canonical R2 S3 API HTTPS endpoint) |
| `R2_BUCKET` | Exactly `litix-private-backups` |
| `AGE_PUBLIC_RECIPIENT` | Your OWN long-term age PUBLIC recipient `age1...`, derived from your offline identity using `age-keygen -y ~/.config/litix-backup/litix-r2-age-identity.txt` |
| `NEON_DIRECT_URL_NEONDB` | Direct, non-pooled, TLS `postgresql://.../neondb?sslmode=require` for Neon main; **not** copied into GitHub code or chat |
| `NEON_DIRECT_URL_LITIXAPI` | Direct, non-pooled, TLS `postgresql://.../litixapi?sslmode=require` for the same Neon main endpoint |
| `NEON_EXPECTED_SOURCE_HOST` | The verified Neon main endpoint hostname from the Neon dashboard connection details (no scheme, password or path) |

To manage repository-level secrets (if you already set those): https://github.com/LitGnosis/Litix/settings/secrets/actions . The preferred location is under the protected GitHub Environment `litix-private-backup`. Do not add the private age decryption identity as any GitHub secret. GitHub-hosted backup decrypts for testing with an **ephemeral temporary recipient** and deletes that key after the run. The durable R2 object is ALSO encrypted to your public age recipient, so only the offline owner key enables recovery later.

Token expiration reported by the owner: 2027-04-28. Plan rotation before that date. This project pins R2 region to `auto` and bucket to `litix-private-backups`, and refuses other destinations.

## How to run: TWO separate manual executions

1. Navigate to https://github.com/LitGnosis/Litix/actions/workflows/litix-r2-manual-production-verify.yml . If the workflow is not yet listed, merge the reviewed workflow PR into the **default `main`** branch first; the action cannot be manually dispatched until it exists on default.
2. Choose **Run workflow → Branch: main**, set **operation = `probe_only`**, leave confirmation blank, then approve the `litix-private-backup` environment review if requested. A true real-world success prints `ACTUAL_R2_CONNECTIVITY_PASS` and `BACKUP_NOT_ATTEMPTED_PROBE_ONLY`. It PUTs 128 random bytes, checks HEAD/GET byte-match and deletes the uniquely named probe. No customer data is touched.
3. After inspecting real run logs, choose **Run workflow → Branch: main**, set **operation = `backup_and_restore`** and **confirm_backup = `BACKUP_BOTH_DBS_READ_ONLY`**. Approve the protected environment. The workflow uses PostgreSQL 18 `pg_dump` against BOTH production application databases (read-only), encrypts to your public age recipient PLUS an ephemeral GitHub-runner recipient, uploads separately named `.pgcustom.age` objects to private R2, downloads and compares the actual ciphertext bytes/SHA256, then decrypts the downloaded archives into two independent, no-network disposable PostgreSQL 18 containers. It verifies core order/fulfillment/bundle and checkout/fulfillment tables are present and readable. No live tables or payments are modified.
4. Actual success requires all markers: `ACTUAL_R2_CONNECTIVITY_PASS`, `ACTUAL_ENCRYPTED_R2_BACKUP_PASS=neondb`, `ACTUAL_ISOLATED_PG18_RESTORE_PASS=neondb`, `ACTUAL_ENCRYPTED_R2_BACKUP_PASS=litixapi`, `ACTUAL_ISOLATED_PG18_RESTORE_PASS=litixapi`, and `ACTUAL_R2_BACKUP_BOTH_DBS_AND_RESTORES_PASS`. Do not mark success from mock CI results.
5. Retain encrypted R2 objects and their SHA256 hashes in an access-controlled recovery register. Store the owner age private key separately, with a second offline encrypted copy. Confirm actual Vercel production runtime database identity before treating these Neon main archives as comprehensive production disaster recovery. No roles/global grants are captured by `pg_dump --no-owner --no-acl`; plan recovery of Postgres globals separately if required.

## Security and monitoring
- `workflow_dispatch` **only**. No push-triggered production export, PR trigger, scheduled task, automatic deployment, payments or supplier dispatch.
- `environment: litix-private-backup`; use owner reviewer gate and `main`-only workflow restrictions. Workflow requests only `contents: read` from GitHub, and disables persistent checkout credentials.
- No customer rows or decrypted dumps are written to GitHub artifacts or printed. PostgreSQL errors and potentially sensitive command output are held in temporary runner-local files and discarded; only generic failures and nonsecret ciphertext hashes/object names are logged.
- R2 credentials are bucket-scoped and stored only in GitHub protected secrets. Owner private age identity is not in GitHub; each run uses a transient additional decrypt recipient that is deleted with the ephemeral runner.
- On a **public** repository, the workflow and its status messages are visible. Protect who can modify default-branch workflows and restrict/review access to the backup environment.
- **INACTIVE** schedule/alert design is at `docs/recovery/LITIX-R2-SCHEDULED-BACKUP-INACTIVE.template.yml`. It creates GitHub issues on backup failure after activation, and has a daily cron template, but is intentionally NOT in `.github/workflows` and cannot execute. Only move/activate it after actual two-DB restore verification, owner approval, cost/capacity review and issue notification review.

## Prioritized remaining blockers
1. The GitHub connector API does not expose repository/environment secret names or permit setting protected secret values through its allowed actions. The owner must confirm the eight names under settings.
2. The assistant cannot dispatch the new workflow with the currently connected GitHub tools. The owner must click Run workflow and approve the environment gate.
3. Even once both actual databases restore, verify runtime production connection mapping, recovered table constraints and user auth boundaries before risky schema migrations.
4. Preserve the 2026-10-25 Neon snapshot, Vercel production deployment and the Boostero-only payment/fulfillment rules.

Official documentation: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow and https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments and https://developers.cloudflare.com/r2/examples/aws/aws-cli/ and https://github.com/age-sops/age .
