#!/usr/bin/env bash
# LITIX Neon encrypted offsite backup — manual, opt-in only.
# No plaintext archive is written. This script never restores/deletes/changes production data.
set -euo pipefail
umask 077
fail(){ printf 'BACKUP_BLOCKED: %s\n' "$*" >&2; exit 2; }
required(){ [[ -n "${!1:-}" ]] || fail "Missing required private setting: $1"; }
for key in NEON_DIRECT_URL NEON_EXPECTED_SOURCE_HOST NEON_BACKUP_DATABASE BACKUP_AGE_RECIPIENT BACKUP_S3_URI; do required "$key"; done
for bin in pg_dump age aws python3 sha256sum mktemp cmp; do command -v "$bin" >/dev/null 2>&1 || fail "Missing executable: $bin"; done

# Cloudflare R2 Standard, private bucket only. Account/bucket setup and billing
# must be approved externally; NEVER store R2 keys or age private keys here.
aws_endpoint_args=()
if [[ "$BACKUP_STORAGE_PROVIDER" == "r2" ]]; then
  required BACKUP_S3_ENDPOINT_URL
  required BACKUP_R2_PRIVATE_BUCKET_CONFIRMED
  required AWS_ACCESS_KEY_ID
  required AWS_SECRET_ACCESS_KEY
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
[[ "$BACKUP_AGE_RECIPIENT" =~ ^age1[a-z0-9]{20,}$ ]] || fail "Encryption recipient must be an age public key (age1...)."
[[ "$BACKUP_S3_URI" =~ ^s3://[a-z0-9][a-z0-9.-]*/[a-zA-Z0-9/_-]+$ ]] || fail "Set BACKUP_S3_URI to an existing private s3://bucket/prefix."
python3 - <<'PY' || fail "Source is not the verified Neon main branch direct TLS endpoint."
import os, urllib.parse
uri=urllib.parse.urlsplit(os.environ["NEON_DIRECT_URL"])
assert uri.scheme in ("postgres","postgresql")
assert uri.hostname == os.environ["NEON_EXPECTED_SOURCE_HOST"]
assert uri.hostname is not None and uri.hostname.startswith("ep-") and uri.hostname.endswith(".neon.tech")
assert uri.hostname is not None and "-pooler" not in uri.hostname
assert urllib.parse.parse_qs(uri.query).get("sslmode")==["require"]
assert os.environ["NEON_BACKUP_DATABASE"] in ("neondb","litixapi")
assert uri.path == "/"+os.environ["NEON_BACKUP_DATABASE"]
PY
dump_version="$(pg_dump --version)"
[[ "$dump_version" =~ PostgreSQL\)\ 18([.\ ]|$) ]] || fail "Use pg_dump major version 18 to match Neon PostgreSQL 18."
tmp="$(mktemp -d -t litix-age-backup.XXXXXXXX)"
trap 'rm -rf -- "$tmp"' EXIT
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
filename="litix-neon-${NEON_BACKUP_DATABASE}-production-${stamp}.pgcustom.age"
destination="${BACKUP_S3_URI%/}/${filename}"
payload="${tmp}/${filename}"
# A single consistent pg_dump snapshot is encrypted before writing the file.
# No plaintext dump, customer records, credentials or AWS tokens are logged.
pg_dump --format=custom --compress=6 --no-owner --no-acl --dbname="$NEON_DIRECT_URL" |
  age --recipient "$BACKUP_AGE_RECIPIENT" --output "$payload"
[[ -s "$payload" ]] || fail "Encrypted archive is empty."
cipher_sha="$(sha256sum "$payload" | awk '{print $1}')"
cipher_size="$(wc -c < "$payload" | tr -d ' ')"
aws "${aws_endpoint_args[@]}" s3 cp "$payload" "$destination" --no-progress --only-show-errors >/dev/null
bucket_and_key="${destination#s3://}"
bucket="${bucket_and_key%%/*}"
key="${bucket_and_key#*/}"
remote_size="$(aws "${aws_endpoint_args[@]}" s3api head-object --bucket "$bucket" --key "$key" --query ContentLength --output text)"
[[ "$cipher_size" == "$remote_size" ]] || fail "Encrypted offsite object size mismatch."
aws "${aws_endpoint_args[@]}" s3 cp "$destination" "$tmp/verified.age" --no-progress --only-show-errors >/dev/null
cmp -s "$payload" "$tmp/verified.age" || fail "Offsite ciphertext differs from local ciphertext."
echo "ENCRYPTED_OFFSITE_COPY_VERIFIED"
echo "SOURCE_DATABASE=$NEON_BACKUP_DATABASE"
echo "CIPHERTEXT_SHA256=$cipher_sha"
echo "CIPHERTEXT_SIZE_BYTES=$cipher_size"
echo "OFFSITE_OBJECT=$destination"
echo "BACKUP_CONTENTS_AND_RESTORE_NOT_YET_VERIFIED"
echo "NEXT: run scripts/neon-restore-isolated-verify.sh with a NEW EMPTY isolated target and private age identity."
