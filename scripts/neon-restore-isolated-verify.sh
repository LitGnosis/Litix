#!/usr/bin/env bash
# Restore-verification ONLY: never target production. No old data is deleted or replaced.
set -euo pipefail
umask 077
fail(){ printf 'RESTORE_TEST_BLOCKED: %s\n' "$*" >&2; exit 2; }
required(){ [[ -n "${!1:-}" ]] || fail "Missing required private setting: $1"; }
for key in NEON_DIRECT_URL RESTORE_DATABASE_URL BACKUP_AGE_IDENTITY BACKUP_OBJECT_URI BACKUP_CIPHERTEXT_SHA256 SAFE_RESTORE_ACK; do required "$key"; done
[[ "$SAFE_RESTORE_ACK" == "NEW_EMPTY_ISOLATED_DATABASE_ONLY" ]] || fail "Explicit isolated restore acknowledgement required."
[[ "$BACKUP_OBJECT_URI" =~ ^s3://[a-z0-9][a-z0-9.-]*/[a-zA-Z0-9/_-]+\.pgcustom\.age$ ]] || fail "Invalid encrypted backup object URI."
[[ "$BACKUP_CIPHERTEXT_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail "Expected SHA256 must be a 64-character lowercase digest."
[[ -f "$BACKUP_AGE_IDENTITY" ]] || fail "Private age identity file not found."
for bin in age aws python3 sha256sum mktemp pg_restore psql; do command -v "$bin" >/dev/null 2>&1 || fail "Missing executable: $bin"; done
# The target must be a separate host AND a uniquely named disposable database.
# Do not accept the production name, the production host or a local database.
python3 - <<'PY' || fail "Source/target isolation check rejected this restore."
import os,urllib.parse
src=urllib.parse.urlsplit(os.environ["NEON_DIRECT_URL"])
dst=urllib.parse.urlsplit(os.environ["RESTORE_DATABASE_URL"])
assert src.scheme in ("postgres","postgresql") and dst.scheme in ("postgres","postgresql")
assert src.hostname == "ep-muddy-credit-awc80y8f.c-12.us-east-1.aws.neon.tech"
assert src.hostname != dst.hostname
assert dst.hostname is not None and dst.hostname.endswith(".neon.tech")
assert dst.hostname.startswith("ep-") and "-pooler" not in dst.hostname
assert urllib.parse.parse_qs(dst.query).get("sslmode")==["require"]
assert dst.path.startswith("/litix_restore_test_") and dst.path.count("/") == 1
PY
tmp="$(mktemp -d -t litix-restore-check.XXXXXXXX)"
trap 'rm -rf -- "$tmp"' EXIT
aws s3 cp "$BACKUP_OBJECT_URI" "$tmp/verified.age" --no-progress --only-show-errors >/dev/null
echo "$BACKUP_CIPHERTEXT_SHA256  $tmp/verified.age" | sha256sum --check --status ||
  fail "Encrypted offsite backup SHA256 mismatch."
# List and verify archive structure without persisting plaintext content.
age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$tmp/verified.age" | pg_restore --list >"$tmp/manifest.txt" ||
  fail "Failed to decrypt/parse PostgreSQL custom archive."
grep -Eq 'TABLE DATA +public +litix_v2_orders ' "$tmp/manifest.txt" || fail "Order table data missing from archive."
grep -Eq 'TABLE DATA +public +litix_boostero_fulfillment ' "$tmp/manifest.txt" || fail "Boostero fulfillment data missing from archive."
grep -Eq 'TABLE DATA +public +litix_growth_bundle_orders ' "$tmp/manifest.txt" || fail "Bundle data missing from archive."
# Fail closed if even one application table exists in the disposable target.
tables="$(psql "$RESTORE_DATABASE_URL" -X -q -t -A -v ON_ERROR_STOP=1 -c "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")"
[[ "$tables" == "0" ]] || fail "Restore target is not a NEW EMPTY database. No changes made."
# Restore is explicitly directed at a different host and an empty litix_restore_test_* database.
age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$tmp/verified.age" |
  pg_restore --dbname="$RESTORE_DATABASE_URL" --exit-on-error --single-transaction --no-owner --no-acl
checks="$(psql "$RESTORE_DATABASE_URL" -X -q -t -A -v ON_ERROR_STOP=1 -c "select (to_regclass('public.litix_v2_orders') is not null) and (to_regclass('public.litix_boostero_fulfillment') is not null) and (to_regclass('public.litix_growth_bundle_orders') is not null)")"
[[ "$checks" == "t" ]] || fail "Isolated restore missing required core tables."
echo "ENCRYPTED_OFFSITE_PG18_RESTORE_VERIFIED"
echo "CORE_ORDERS_BOOSTERO_BUNDLES_TABLES_VERIFIED"
echo "SOURCE_PRODUCTION_WAS_NOT_MODIFIED"
echo "Keep the isolated restore intact until the owner approves its safe disposal."
