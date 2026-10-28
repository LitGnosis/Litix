#!/usr/bin/env bash
# OWNER-ONLY: Execute on a trusted, access-controlled Mac/Linux/WSL computer.
# Does NOT create Cloudflare subscriptions, keys, customers or resources.
# Reads production through direct TLS pg_dump, writes only AGE-ENCRYPTED data
# to the confirmed PRIVATE R2 bucket, then performs LOCAL OFFLINE restores.
# Never run on ChatGPT, public GitHub Actions, Vercel or shared computers.
set -euo pipefail
umask 077
fail(){ printf 'LITIX_BACKUP_NOT_VERIFIED: %s\n' "$*" >&2; exit 2; }
required(){ [[ -n "${!1:-}" ]] || fail "Missing local secret/config: $1"; }
for key in \
  BACKUP_STORAGE_PROVIDER BACKUP_S3_ENDPOINT_URL BACKUP_S3_URI \
  BACKUP_R2_PRIVATE_BUCKET_CONFIRMED BACKUP_AGE_RECIPIENT BACKUP_AGE_IDENTITY \
  NEON_EXPECTED_SOURCE_HOST \
  LITIX_NEON_DIRECT_URL_NEONDB LITIX_NEON_DIRECT_URL_LITIXAPI; do
  required "$key"
done
[[ "$BACKUP_STORAGE_PROVIDER" == "r2" ]] || fail "R2 private-only backup required."
[[ "$BACKUP_S3_URI" == "s3://litix-private-backups/"* ]] ||
  fail "Backup destination must be the owner-authorized private bucket litix-private-backups"

# Read R2 credentials ONLY from the owner's local profile or secure environment.
if [[ -n "${R2_ACCESS_KEY_ID:-}" || -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
  required R2_ACCESS_KEY_ID
  required R2_SECRET_ACCESS_KEY
  export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
  unset AWS_PROFILE AWS_DEFAULT_PROFILE 2>/dev/null || true
fi
if [[ -n "${AWS_ACCESS_KEY_ID:-}" || -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
  required AWS_ACCESS_KEY_ID
  required AWS_SECRET_ACCESS_KEY
elif [[ "${AWS_PROFILE:-}" != "litix-r2-backup" ]]; then
  fail "Use the owner-local AWS_PROFILE=litix-r2-backup or inject both private R2 credentials"
fi

[[ "$BACKUP_R2_PRIVATE_BUCKET_CONFIRMED" == "I_VERIFIED_NO_PUBLIC_ACCESS" ]] ||
  fail "Verify Cloudflare R2 public access is disabled."
[[ -f "$BACKUP_AGE_IDENTITY" && ! -L "$BACKUP_AGE_IDENTITY" ]] ||
  fail "Owner-held age private identity must be a local, non-symlinked file."
for executable in age-keygen pg_dump age aws docker python3 sha256sum; do
  command -v "$executable" >/dev/null 2>&1 || fail "Missing executable: $executable"
done
actual_recipient="$(age-keygen -y "$BACKUP_AGE_IDENTITY")"
[[ "$actual_recipient" == "$BACKUP_AGE_RECIPIENT" ]] ||
  fail "Public encryption recipient does NOT match owner-held private identity; abort before export."
[[ "${LITIX_R2_BACKUP_OWNER_ACK:-}" == "I_APPROVE_ENCRYPTED_EXPORT_AND_ISOLATED_RESTORE" ]] ||
  fail "Explicit owner export-and-local-restore acknowledgement missing."
python3 - <<'PY' || fail "Expected two DIFFERENT private Neon database URLs on main with direct TLS."
import os,urllib.parse
host=os.environ["NEON_EXPECTED_SOURCE_HOST"]
assert host.startswith("ep-") and host.endswith(".neon.tech") and "-pooler" not in host
for database,env in [("neondb","LITIX_NEON_DIRECT_URL_NEONDB"),("litixapi","LITIX_NEON_DIRECT_URL_LITIXAPI")]:
 u=urllib.parse.urlsplit(os.environ[env])
 assert u.scheme in ("postgres","postgresql")
 assert u.hostname==host and u.path=="/"+database
 assert urllib.parse.parse_qs(u.query).get("sslmode")==["require"]
PY
[[ "${DOCKER_HOST:-}" == "" || "${DOCKER_HOST:-}" == unix://* ]] || fail "Remote Docker host prohibited."
docker_uri="$(docker context inspect "$(docker context show)" --format '{{ (index .Endpoints "docker").Host }}' 2>/dev/null)" ||
  fail "Docker daemon identity unavailable."
[[ "$docker_uri" == unix://* ]] || fail "Docker endpoint is not local."

success_count=0
for db in neondb litixapi; do
  export NEON_BACKUP_DATABASE="$db"
  if [[ "$db" == "neondb" ]]; then
    export NEON_DIRECT_URL="$LITIX_NEON_DIRECT_URL_NEONDB"
  else
    export NEON_DIRECT_URL="$LITIX_NEON_DIRECT_URL_LITIXAPI"
  fi
  printf 'BACKUP_STAGE=%s\n' "$db"
  result="$(bash "$(dirname "$0")/neon-backup-encrypted-offsite.sh")" ||
    fail "$db encrypted upload or ciphertext validation failed; no backup verified."
  grep -q '^ENCRYPTED_OFFSITE_COPY_VERIFIED$' <<< "$result" ||
    fail "$db encrypted backup success marker missing."
  object="$(sed -n 's/^OFFSITE_OBJECT=//p' <<< "$result" | tail -1)"
  digest="$(sed -n 's/^CIPHERTEXT_SHA256=//p' <<< "$result" | tail -1)"
  [[ "$object" == s3://* && "$digest" =~ ^[a-f0-9]{64}$ ]] ||
    fail "$db encrypted backup metadata unavailable."
  export BACKUP_OBJECT_URI="$object" BACKUP_CIPHERTEXT_SHA256="$digest"
  export RESTORE_LOCAL_DOCKER_ACK=I_APPROVE_OFFLINE_DOCKER_RESTORE
  restored="$(bash "$(dirname "$0")/neon-restore-local-docker-r2.sh")" ||
    fail "$db encrypted upload complete, but isolated restoration FAILED; retain the backup."
  grep -q '^LOCAL_OFFLINE_POSTGRES18_ENCRYPTED_RESTORE_VERIFIED$' <<< "$restored" ||
    fail "$db isolated restore success marker missing."
  grep -q "^RESTORED_DATABASE=$db$" <<< "$restored" ||
    fail "$db restored database mismatch."
  printf 'VERIFIED_DATABASE=%s\nENCRYPTED_OBJECT=%s\nCIPHERTEXT_SHA256=%s\n' "$db" "$object" "$digest"
  success_count=$((success_count+1))
done
[[ "$success_count" == "2" ]] || fail "Both database archives have not been restored."
echo "LITIX_BOTH_PRODUCTION_DATABASES_ENCRYPTED_OFFSITE_AND_RESTORED_VERIFIED"
echo "Keep the age private key offline and verify the Cloudflare bucket remains private."
