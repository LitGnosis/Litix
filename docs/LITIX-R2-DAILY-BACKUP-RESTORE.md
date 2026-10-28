# Litix encrypted daily Neon backups — operational recovery

Workflow: `.github/workflows/litix-r2-manual-production-verify.yml`
Schedule: daily at 08:00 UTC, **only once this branch is merged into default main**. GitHub schedules can be delayed. Manual `probe_only` and `backup_and_restore` remain supported.

## Source and destination safeguards
- Both source URLs must resolve to the same pinned direct Neon production main hostname and to their exact database names (`neondb` and `litixapi`), require `sslmode=require`, and refuse pooler hosts.
- Uses PostgreSQL 18 `pg_dump -Fc` without writing plaintext dumps to disk. Encrypts streamed backups to the **owner's age PUBLIC recipient** and a per-run ephemeral recipient.
- R2 destination fixed to private `litix-private-backups`, under `litix-production/neondb/` and `litix-production/litixapi/`; each key is timestamped. HTTP PUT/HEAD/GET probe, per-object HEAD size check, downloaded ciphertext byte comparison and SHA-256 match. A run fails unless both succeed.
- The existing workflow also decrypts with the **ephemeral** age identity and restores each database into separate disposable PostgreSQL 18 containers with `--network none`, validates core tables, destroys containers and temporary material. It never uses the owner's offline age private identity.
- No customer data or private keys in GitHub artifacts, commit, or logs. Retain the owner's private age identity **offline**, never in GitHub.
- GitHub concurrency group prevents overlapping runs. Only `contents: read` permission, protected environment `litix-private-backup`, and default branch guard.

## IMPORTANT first-run acceptance / scheduled operation
- Secrets reportedly configured, but naming alone does **not** establish that access to R2 or Neon works.
- Before relying on this backup, inspect an actual completed manual `backup_and_restore` run for both `ACTUAL_ENCRYPTED_R2_BACKUP_PASS` and both `ACTUAL_ISOLATED_PG18_RESTORE_PASS` markers, then verify the retained objects in R2. Failed or approval-waiting runs do not count.
- If `litix-private-backup` has mandatory human reviewers, **scheduled runs may wait for approval** rather than execute unattended; admins must assess runner trust and protected environment policy. Never remove protection solely to make a scheduled backup look successful.
- A cron definition in a feature branch is **not an active schedule**. It becomes eligible only after merge to `main`.
- Monitor failed or pending runs; the workflow fails closed, but does not itself send owner email alerts.
- R2 retention policy and periodic recovery drills must be approved; the script intentionally never deletes old encrypted backups.

## Owner-key recovery drill (offline only)
1. On a trusted isolated, disposable recovery machine, retrieve the two exact dated `.pgcustom.age` objects from the private R2 bucket, verify SHA-256 against the recorded GitHub run hashes. Never upload the owner age private key to GitHub or cloud CI.
2. Using a locally available age identity file, decrypt to a **pipe** feeding PostgreSQL 18 `pg_restore` against new disposable `postgres:18` databases or offline containers. Example for one file: `age -d -i "$PRIVATE_AGE_IDENTITY" backup.pgcustom.age | pg_restore -h 127.0.0.1 -U postgres -d disposable_neondb --no-owner --no-acl --exit-on-error --single-transaction`. Use a local-only Postgres endpoint with no production credentials; repeat for `litixapi`.
3. Inspect restored schemas, table access, row consistency and app-compatible migrations; do not output private rows or secrets.
4. Delete disposable environments and downloaded ciphertext when finished; retain recovery evidence separately. **Until performed with the owner key, recovery via the owner's key remains unverified.**

## Scope
This PR changes backup scripts/workflow only. No migrations, order processing, payment, Boostero, storefront, environment-variable values or site deployment. 
