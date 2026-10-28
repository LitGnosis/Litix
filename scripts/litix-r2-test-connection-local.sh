#!/usr/bin/env bash
# Owner-only Cloudflare R2 connectivity test, no customer database access.
# Uses a local AWS named profile OR private runtime environment credentials.
# DO NOT execute as a public GitHub Action or on a shared host.
set -euo pipefail
set +x
umask 077
fail(){ printf 'R2_CONNECTION_BLOCKED: %s\n' "$*" >&2; exit 2; }
for tool in aws python3 sha256sum mktemp cmp; do
 command -v "$tool" >/dev/null 2>&1 || fail "Missing local program: $tool"
done
: "${R2_ENDPOINT:?R2_ENDPOINT must be the canonical account-specific HTTPS R2 endpoint}"
bucket="${R2_BUCKET:-litix-private-backups}"
[[ "$bucket" == "litix-private-backups" ]] || fail "Refusing to test another bucket; expected litix-private-backups"
[[ "${R2_PRIVATE_BUCKET_CONFIRMED:-}" == "I_VERIFIED_NO_PUBLIC_ACCESS" ]] ||
 fail "Confirm public access is disabled in Cloudflare before testing"
python3 - <<'PY' || fail "Invalid account-specific Cloudflare R2 HTTPS S3 endpoint"
import os,re,urllib.parse
u=urllib.parse.urlsplit(os.environ["R2_ENDPOINT"])
assert u.scheme=="https" and u.hostname and re.fullmatch(r"[a-f0-9]{32}\.r2\.cloudflarestorage\.com",u.hostname)
assert not (u.username or u.password or u.query or u.fragment or u.port)
assert u.path in ("","/")
PY
# Credential selection: prefer the exact local profile, or mapped R2 env names.
# Never store a key in this script or print credentials.
if [[ -n "${R2_ACCESS_KEY_ID:-}" || -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
 [[ -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]] ||
  fail "Both private R2 credentials are required if using environment variables"
 export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
 export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
 unset AWS_PROFILE AWS_DEFAULT_PROFILE 2>/dev/null || true
elif [[ -n "${AWS_ACCESS_KEY_ID:-}" || -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
 [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" ]] ||
  fail "Both AWS-style environment credentials are required"
else
 export AWS_PROFILE="${AWS_PROFILE:-litix-r2-backup}"
 [[ "$AWS_PROFILE" == "litix-r2-backup" ]] ||
   fail "Only the dedicated litix-r2-backup local AWS profile is accepted"
fi
export AWS_DEFAULT_REGION=auto AWS_EC2_METADATA_DISABLED=true AWS_PAGER="" AWS_CLI_AUTO_PROMPT=off
tmp="$(mktemp -d -t litix-r2-connectivity.XXXXXXXX)"
object="litix-readiness-probes/connection-$(python3 -c 'import secrets;print(secrets.token_hex(20))').bin"
cleanup(){
 # Never delete any other object; only this unique harmless probe.
 if [[ "${uploaded:-false}" == true ]]; then
   aws --endpoint-url "$R2_ENDPOINT" s3api delete-object --bucket "$bucket" --key "$object" --output json >/dev/null 2>&1 ||
     printf 'WARNING: Could not delete harmless temporary object %s; remove it in Cloudflare.\n' "$object" >&2
 fi
 rm -rf -- "$tmp"
}
trap cleanup EXIT
python3 - "$tmp/probe.bin" <<'PY'
import os,secrets,sys
with open(sys.argv[1],"xb") as f:f.write(secrets.token_bytes(128))
PY
digest="$(sha256sum "$tmp/probe.bin" | awk '{print $1}')"
uploaded=false
# A successful private-key scoped PutObject is a real permission check.
aws --endpoint-url "$R2_ENDPOINT" s3api put-object \
 --bucket "$bucket" --key "$object" --body "$tmp/probe.bin" --output json >/dev/null ||
 fail "PutObject denied: check account, endpoint, bucket restriction, token expiration"
uploaded=true
size="$(aws --endpoint-url "$R2_ENDPOINT" s3api head-object \
 --bucket "$bucket" --key "$object" --query ContentLength --output text)" ||
 fail "HeadObject denied: check read permission"
[[ "$size" == 128 ]] || fail "Uploaded test size does not match"
aws --endpoint-url "$R2_ENDPOINT" s3api get-object \
 --bucket "$bucket" --key "$object" "$tmp/download.bin" --output json >/dev/null ||
 fail "GetObject denied: check read permission"
cmp -s "$tmp/probe.bin" "$tmp/download.bin" || fail "Downloaded bytes differ"
[[ "$(sha256sum "$tmp/download.bin" | awk '{print $1}')" == "$digest" ]] ||
 fail "Downloaded checksum mismatch"
aws --endpoint-url "$R2_ENDPOINT" s3api delete-object \
 --bucket "$bucket" --key "$object" --output json >/dev/null ||
 fail "Temporary object deletion failed; clean up the object manually"
uploaded=false
echo "R2_PRIVATE_BUCKET_PUT_HEAD_GET_DELETE_VERIFIED"
echo "BUCKET=$bucket"
echo "REGION=auto"
echo "PROBE_SHA256=$digest"
echo "NO_CUSTOMER_DATA_ACCESSED"
