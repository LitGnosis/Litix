#!/usr/bin/env bash
# Restore-verification ONLY: never target production. No old data is deleted or replaced.
set -euo pipefail
umask 077
fail(){ printf 'RESTORE_TEST_BLOCKED: %s\n' "$*" >&2; exit 2; }
required(){ [[ -n "${!1:-}" ]] || fail "Missing required private setting: $1"; }
for key in NEON_DIRECT_URL NEON_EXPECTED_SOURCE_HOST NEON_BACKUP_DATABASE RESTORE_DATABASE_URL BACKUP_AGE_IDENTITY BACKUP_OBJECT_URI BACKUP_CIPHERTEXT_SHA256 SAFE_RESTORE_ACK; do required "$key"; done
[[ "$SAFE_RESTORE_ACK" == "NEW_EMPTY_ISOLATED_DATABASE_ONLY" ]] || fail "Explicit isolated restore acknowledgement required."
[[ "$BACKUP_OBJECT_URI" =~ ^s3://[a-z0-9][a-z0-9.-]*/[a-zA-Z0-9/_-]+\.pgcustom\.age$ ]] || fail "Invalid encrypted backup object URI."
[[ "$BACKUP_CIPHERTEXT_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail "Expected SHA256 must be a 64-character lowercase digest."
[[ -f "$BACKUP_AGE_IDENTITY" ]] || fail "Private age identity file not found."
for bin in age aws python3 sha256sum mktemp pg_restore psql; do command -v "$bin" >/dev/null 2>&1 || fail "Missing executable: $bin"; done

# Cloudflare R2 Standard, private bucket only. Account/bucket setup and billing
# must be approved externally; NEVER store R2 keys or age private keys here.
required BACKUP_STORAGE_PROVIDER
aws_endpoint_args=()
if [[ "$BACKUP_STORAGE_PROVIDER" == "r2" ]]; then
  required BACKUP_S3_ENDPOINT_URL
  required BACKUP_R2_PRIVATE_BUCKET_CONFIRMED
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
    fail "Cloudflare dashboard private-bucket confirmation is required."
  python3 - <<'PY' || fail "Cloudflare R2 endpoint must be the canonical account-specific HTTPS S3 endpoint."
import os,re,urllib.parse
s=urllib.parse.urlsplit(os.environ["BACKUP_S3_ENDPOINT_URL"])
assert s.scheme=="https" and s.path in ("","/") and not s.query and not s.username
assert s.hostname and re.fullmatch(r"[0-9a-f]{32}\.r2\.cloudflarestorage\.com",s.hostname)
PY
  export AWS_DEFAULT_REGION=auto AWS_EC2_METADATA_DISABLED=true AWS_PAGER=""
  aws_endpoint_args=(--endpoint-url "$BACKUP_S3_ENDPOINT_URL")
elif [[ "$BACKUP_STORAGE_PROVIDER" != "aws-s3" ]]; then
  fail "Set BACKUP_STORAGE_PROVIDER=r2 or aws-s3. No cloud storage destination is assumed."
fi
# The target must be a separate host AND a uniquely named disposable database.
# Do not accept the production name, the production host or a local database.
python3 - <<'PY' || fail "Source/target isolation check rejected this restore."
import os,urllib.parse
src=urllib.parse.urlsplit(os.environ["NEON_DIRECT_URL"])
dst=urllib.parse.urlsplit(os.environ["RESTORE_DATABASE_URL"])
assert src.scheme in ("postgres","postgresql") and dst.scheme in ("postgres","postgresql")
assert src.hostname == os.environ["NEON_EXPECTED_SOURCE_HOST"]
assert src.hostname is not None and src.hostname.startswith("ep-") and src.hostname.endswith(".neon.tech")
assert os.environ["NEON_BACKUP_DATABASE"] in ("neondb","litixapi")
assert src.path == "/"+os.environ["NEON_BACKUP_DATABASE"]
assert src.hostname != dst.hostname
assert dst.hostname is not None and dst.hostname.endswith(".neon.tech")
assert dst.hostname.startswith("ep-") and "-pooler" not in dst.hostname
assert urllib.parse.parse_qs(dst.query).get("sslmode")==["require"]
assert dst.path.startswith("/litix_restore_test_"+os.environ["NEON_BACKUP_DATABASE"]+"_") and dst.path.count("/") == 1
PY
tmp="$(mktemp -d -t litix-restore-check.XXXXXXXX)"
trap 'rm -rf -- "$tmp"' EXIT
aws "${aws_endpoint_args[@]}" s3 cp "$BACKUP_OBJECT_URI" "$tmp/verified.age" --no-progress --only-show-errors >/dev/null
echo "$BACKUP_CIPHERTEXT_SHA256  $tmp/verified.age" | sha256sum --check --status ||
  fail "Encrypted offsite backup SHA256 mismatch."
# List and verify archive structure without persisting plaintext content.
age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$tmp/verified.age" | pg_restore --list >"$tmp/manifest.txt" ||
  fail "Failed to decrypt/parse PostgreSQL custom archive."
if [[ "$NEON_BACKUP_DATABASE" == "neondb" ]]; then
  for table in litix_v2_orders litix_boostero_fulfillment litix_growth_bundle_orders; do
    grep -Eq "TABLE DATA +public +$table " "$tmp/manifest.txt" || fail "Expected neondb table missing: $table"
  done
else
  for table in packages checkouts fulfillment_outbox; do
    grep -Eq "TABLE DATA +public +$table " "$tmp/manifest.txt" || fail "Expected litixapi table missing: $table"
  done
fi
# Fail closed if even one application table exists in the disposable target.
tables="$(psql "$RESTORE_DATABASE_URL" -X -q -t -A -v ON_ERROR_STOP=1 -c "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")"
[[ "$tables" == "0" ]] || fail "Restore target is not a NEW EMPTY database. No changes made."
# Restore is explicitly directed at a different host and an empty litix_restore_test_* database.
age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$tmp/verified.age" |
  pg_restore --dbname="$RESTORE_DATABASE_URL" --exit-on-error --single-transaction --no-owner --no-acl
if [[ "$NEON_BACKUP_DATABASE" == "neondb" ]]; then
  sql="SELECT (to_regclass('public.litix_v2_orders') IS NOT NULL) AND (to_regclass('public.litix_boostero_fulfillment') IS NOT NULL) AND (to_regclass('public.litix_growth_bundle_orders') IS NOT NULL)"
else
  sql="SELECT (to_regclass('public.packages') IS NOT NULL) AND (to_regclass('public.checkouts') IS NOT NULL) AND (to_regclass('public.fulfillment_outbox') IS NOT NULL)"
fi
checks="$(psql "$RESTORE_DATABASE_URL" -X -q -t -A -v ON_ERROR_STOP=1 -c "$sql")"
[[ "$checks" == "t" ]] || fail "Isolated restore missing required core tables."
echo "ENCRYPTED_OFFSITE_PG18_RESTORE_VERIFIED"
echo "EXPECTED_DATABASE_TABLES_VERIFIED"
echo "RESTORED_DATABASE=$NEON_BACKUP_DATABASE"
echo "SOURCE_PRODUCTION_WAS_NOT_MODIFIED"
echo "Keep the isolated restore intact until the owner approves its safe disposal."
