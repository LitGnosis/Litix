#!/usr/bin/env bash
# Verify an encrypted R2 PostgreSQL 18 backup using a LOCAL, NETWORK-ISOLATED
# disposable Docker database. Never connects a restore client to production.
# Does not write plaintext archives or credentials to the source repository.
set -euo pipefail
umask 077
fail(){ printf 'LOCAL_RESTORE_BLOCKED: %s\n' "$*" >&2; exit 2; }
required(){ [[ -n "${!1:-}" ]] || fail "Missing private configuration: $1"; }
for k in NEON_BACKUP_DATABASE BACKUP_OBJECT_URI BACKUP_CIPHERTEXT_SHA256 \
 BACKUP_AGE_IDENTITY BACKUP_S3_ENDPOINT_URL BACKUP_R2_PRIVATE_BUCKET_CONFIRMED \
 BACKUP_STORAGE_PROVIDER AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY RESTORE_LOCAL_DOCKER_ACK; do required "$k"; done
[[ "$BACKUP_STORAGE_PROVIDER" == "r2" ]] || fail "This script is R2-only."
[[ "$BACKUP_R2_PRIVATE_BUCKET_CONFIRMED" == "I_VERIFIED_NO_PUBLIC_ACCESS" ]] || fail "Bucket privacy must be checked in Cloudflare."
[[ "$RESTORE_LOCAL_DOCKER_ACK" == "I_APPROVE_OFFLINE_DOCKER_RESTORE" ]] || fail "Local private Docker restore needs explicit acknowledgement."
[[ "$NEON_BACKUP_DATABASE" == "neondb" || "$NEON_BACKUP_DATABASE" == "litixapi" ]] || fail "Unknown application DB."
[[ "$BACKUP_CIPHERTEXT_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail "Expected ciphertext SHA256 digest missing."
[[ -f "$BACKUP_AGE_IDENTITY" ]] || fail "Age private identity file is not readable."
[[ "$BACKUP_OBJECT_URI" =~ ^s3://[a-z0-9][a-z0-9.-]*/[a-zA-Z0-9/_-]+\.pgcustom\.age$ ]] || fail "Invalid private backup URI."
[[ "$BACKUP_OBJECT_URI" == *"/litix-neon-${NEON_BACKUP_DATABASE}-production-"* ]] ||
 fail "Archive filename does not match the selected source database."
for executable in aws age docker mktemp sha256sum python3; do command -v "$executable" >/dev/null || fail "Missing $executable"; done
python3 - <<'PY' || fail "Invalid Cloudflare R2 endpoint."
import os,re,urllib.parse
u=urllib.parse.urlsplit(os.environ["BACKUP_S3_ENDPOINT_URL"])
assert u.scheme=="https" and u.hostname and re.fullmatch(r"[a-f0-9]{32}\.r2\.cloudflarestorage\.com",u.hostname)
assert u.path in ("","/") and not u.username and not u.password and not u.query
PY
# Docker can be configured to point to a remote daemon; DO NOT transfer private
# customer records to such a host. Only Unix-domain socket local daemons qualify.
[[ "${DOCKER_HOST:-}" == "" || "${DOCKER_HOST:-}" == unix://* ]] || fail "Remote Docker host is prohibited."
daemon_uri="$(docker context inspect "$(docker context show)" --format '{{ (index .Endpoints "docker").Host }}' 2>/dev/null)" ||
 fail "Cannot inspect Docker daemon endpoint."
[[ "$daemon_uri" == unix://* ]] || fail "Docker context is not a verified local Unix socket."
tmp="$(mktemp -d -t litix-r2-local-verify.XXXXXXXX)"
container="litix-restore-${NEON_BACKUP_DATABASE}-$$-${RANDOM}"
cleanup(){
  docker rm -f -v "$container" >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT
cipher="$tmp/archive.pgcustom.age"
export AWS_DEFAULT_REGION=auto AWS_EC2_METADATA_DISABLED=true AWS_PAGER=""
aws --endpoint-url "$BACKUP_S3_ENDPOINT_URL" s3 cp "$BACKUP_OBJECT_URI" "$cipher" --no-progress --only-show-errors >/dev/null
printf '%s  %s\n' "$BACKUP_CIPHERTEXT_SHA256" "$cipher" | sha256sum --check --status ||
 fail "Offsite object SHA256 differs from verified encrypted backup."
# No ports, no network, no bind mounts. Disposable container removed with data
# when verification exits, regardless of success or failure.
docker run -d --rm --network none --name "$container" \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB="$NEON_BACKUP_DATABASE" \
  postgres:18-alpine >/dev/null || fail "Could not start isolated PostgreSQL 18."
ready=false
for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d "$NEON_BACKUP_DATABASE" >/dev/null 2>&1; then
    ready=true; break
  fi
  sleep 1
done
[[ "$ready" == "true" ]] || fail "Local PostgreSQL 18 did not become ready."
# Only TOC names are written to temporary disk, never customer data.
age --decrypt -i "$BACKUP_AGE_IDENTITY" "$cipher" |
 docker exec -i "$container" pg_restore --list > "$tmp/manifest.txt" ||
 fail "Archive decryption / PostgreSQL TOC inspection failed."
if [[ "$NEON_BACKUP_DATABASE" == "neondb" ]]; then
  tables=(litix_v2_orders litix_boostero_fulfillment litix_growth_bundle_orders)
else
  tables=(packages checkouts fulfillment_outbox)
fi
for table in "${tables[@]}"; do
  grep -Eq "TABLE DATA +public +$table " "$tmp/manifest.txt" || fail "Required source table absent from backup: $table"
done
age --decrypt -i "$BACKUP_AGE_IDENTITY" "$cipher" |
 docker exec -i "$container" pg_restore -U postgres -d "$NEON_BACKUP_DATABASE" \
    --exit-on-error --single-transaction --no-owner --no-acl ||
 fail "Isolated restore failed."
for table in "${tables[@]}"; do
  status="$(docker exec "$container" psql -h 127.0.0.1 -U postgres \
    -d "$NEON_BACKUP_DATABASE" -X -q -t -A -v ON_ERROR_STOP=1 \
    -c "SELECT to_regclass('public.$table') IS NOT NULL" | tr -d '[:space:]')"
  [[ "$status" == "t" ]] || fail "Restored table missing: $table"
  docker exec "$container" psql -h 127.0.0.1 -U postgres \
    -d "$NEON_BACKUP_DATABASE" -X -q -t -A -v ON_ERROR_STOP=1 \
    -c "SELECT count(*) FROM public.$table" >/dev/null || fail "Restored table unreadable: $table"
done
echo "LOCAL_OFFLINE_POSTGRES18_ENCRYPTED_RESTORE_VERIFIED"
echo "RESTORED_DATABASE=$NEON_BACKUP_DATABASE"
echo "NO_PRODUCTION_DATABASE_CONNECTION_OR_PORT_EXPOSED"
