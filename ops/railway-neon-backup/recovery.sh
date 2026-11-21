#!/usr/bin/env bash
# Non-destructive, automated pg_dump. Do NOT restore, dispatch jobs, or modify live orders here.
set -Eeuo pipefail
umask 077
export PGCONNECT_TIMEOUT=12
export PGSSLMODE=require
# Explicitly make source sessions read-only at the server transaction layer.
export PGOPTIONS="-c default_transaction_read_only=on"

if [[ "$(python3 /recovery/upload.py check)" == "COMPLETE" ]]; then
  printf 'source_archive_already_complete: no new backup written\n'
  exit 0
fi

declare -A SOURCE_VARS=(
  [neondb]=NEON_SOURCE_NEONDB_URL
  [litixapi]=NEON_SOURCE_LITIXAPI_URL
  [litgnosis_platform]=NEON_SOURCE_LITGNOSIS_PLATFORM_URL
)
ORDER=(neondb litixapi litgnosis_platform)
for db in "\${ORDER[@]}"; do
  key="\${SOURCE_VARS[$db]}"
  if [[ -z "\${!key:-}" ]]; then
    printf 'source_credential_missing db=%s\n' "$db"
    exit 0
  fi
done

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
for db in "\${ORDER[@]}"; do
  key="\${SOURCE_VARS[$db]}"
  conn="\${!key}"
  # Never echo a connection string, password, SQL row, or customer PII.
  if ! psql "$conn" --no-psqlrc -A -t -q -c "SELECT 1" >/dev/null 2>&1; then
    printf 'source_not_yet_available db=%s (quota or connection)\n' "$db"
    exit 0
  fi
  if ! pg_dump --dbname="$conn" \
       --format=custom --compress=6 --no-owner --no-acl \
       --file="$workdir/$db.dump" >/dev/null 2>&1; then
    printf 'source_dump_incomplete db=%s (no upload; retry on next scheduled run)\n' "$db"
    exit 0
  fi
  if ! pg_restore --list "$workdir/$db.dump" >/dev/null 2>&1; then
    printf 'source_archive_failed_integrity_check db=%s\n' "$db"
    exit 0
  fi
  printf 'source_archive_verified db=%s\n' "$db"
done

# The uploader checks remote byte lengths and SHA-256 metadata, and writes its
# completion marker only AFTER all three databases are archived.
python3 /recovery/upload.py upload "$workdir"
printf 'neon_source_recovery_archived_all_three_databases\n'
