#!/usr/bin/env bash
# OWNER-AUTHORIZED, MANUAL-ONLY R2 recovery verification in an ephemeral GitHub runner.
# Never upload secrets/customer contents to GitHub artifacts or logs.
# Does NOT store the owner's long-lived age private identity in GitHub:
# encrypts to the owner's PUBLIC age recipient plus a temporary runner identity,
# which is discarded after isolated restore verification.
set -Eeuo pipefail
set +x
umask 077
fail(){ printf 'LITIX_RECOVERY_BLOCKED: %s\n' "$*" >&2; exit 2; }
need(){ [[ -n "${!1:-}" ]] || fail "Missing protected environment secret: $1"; }
for x in R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT R2_BUCKET LITIX_RECOVERY_MODE; do need "$x"; done
[[ "$R2_BUCKET" == "litix-private-backups" ]] || fail "The bucket is not the approved litix-private-backups."
python3 - <<'PY' || fail "Invalid account-specific Cloudflare R2 HTTPS endpoint."
import os,re,urllib.parse
u=urllib.parse.urlsplit(os.environ["R2_ENDPOINT"])
assert u.scheme=="https" and re.fullmatch(r"[a-f0-9]{32}\.r2\.cloudflarestorage\.com",u.hostname or "")
assert not (u.username or u.password or u.port or u.query or u.fragment) and u.path in ("","/")
PY
[[ "$LITIX_RECOVERY_MODE" == "probe_only" || "$LITIX_RECOVERY_MODE" == "backup_and_restore" ]] ||
 fail "Unknown mode; use probe_only or backup_and_restore."
for command in python3 age age-keygen docker sha256sum cmp mktemp;do
 command -v "$command" >/dev/null || fail "Missing protected-runner utility: $command"
done
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto AWS_EC2_METADATA_DISABLED=true AWS_PAGER="" AWS_CLI_AUTO_PROMPT=off
export AWS_MAX_ATTEMPTS=2
# R2 uses the scoped boto3 adapter: fixed-length probe bytes and S3-compatible
# multipart ciphertext uploads, without unsupported AWS CLI streaming trailers.
# Independent encrypted file roundtrip and SHA256 validation are preserved.
work="$(mktemp -d -t litix-r2-recovery.XXXXXXXX)"
probe_key="" probe_uploaded=false current_container=""
cleanup(){
 set +e
 if [[ -n "$current_container" ]];then docker rm -f -v "$current_container" >/dev/null 2>&1;fi
 if [[ "$probe_uploaded" == true && -n "$probe_key" ]];then
  python3 scripts/litix-r2-boto3-transfer.py delete "$probe_key" >/dev/null 2>&1
 fi
 rm -rf -- "$work"
}
trap cleanup EXIT

# Harmless object PUT/HEAD/GET/DELETE test, no ListBucket permission needed.
probe_key="litix-backup-probes/probe-${GITHUB_RUN_ID:-0}-$(python3 -c 'import secrets;print(secrets.token_hex(16))').bin"
python3 - "$work/probe" <<'PY'
import secrets,sys
with open(sys.argv[1],"xb") as f:f.write(secrets.token_bytes(128))
PY
if ! python3 scripts/litix-r2-boto3-transfer.py put "$probe_key" "$work/probe" \
  >"$work/put.status" 2>"$work/put.err";then
  grep -E '^R2_TRANSFER_ERROR_(CODE_SAFE|CLASS)=' "$work/put.err" | tail -1 || true
  fail "Real R2 PutObject failed; inspect safe transport error code."
fi
probe_uploaded=true
probe_size="$(python3 scripts/litix-r2-boto3-transfer.py head "$probe_key" \
  2>"$work/head.err")" || fail "Real R2 HeadObject failed."
[[ "$probe_size" == 128 ]] || fail "R2 probe object size mismatch."
python3 scripts/litix-r2-boto3-transfer.py get "$probe_key" "$work/probe-read" \
  >"$work/get.status" 2>"$work/get.err" || fail "Real R2 GetObject failed."
cmp -s "$work/probe" "$work/probe-read" || fail "R2 probe integrity failed."
python3 scripts/litix-r2-boto3-transfer.py delete "$probe_key" \
  >"$work/delete.status" 2>"$work/delete.err" || fail "R2 probe DeleteObject failed."
probe_uploaded=false
echo "ACTUAL_R2_CONNECTIVITY_PASS"
echo "R2_BUCKET=litix-private-backups"
echo "R2_OPERATION=put_head_get_delete_byte_match"

if [[ "$LITIX_RECOVERY_MODE" == "probe_only" ]];then
 echo "BACKUP_NOT_ATTEMPTED_PROBE_ONLY"
 exit 0
fi
[[ "${LITIX_CONFIRM_BACKUP:-}" == "BACKUP_BOTH_DBS_READ_ONLY" || ( "${GITHUB_EVENT_NAME:-}" == "schedule" && "${GITHUB_REF:-}" == "refs/heads/main" && "${LITIX_CONFIRM_BACKUP:-}" == "SCHEDULED_BOTH_DBS_READ_ONLY" ) ]] ||
 fail "Real database export requires the explicit manual confirmation input."
for x in AGE_PUBLIC_RECIPIENT NEON_DIRECT_URL_NEONDB NEON_DIRECT_URL_LITIXAPI NEON_EXPECTED_SOURCE_HOST;do need "$x";done
[[ "$AGE_PUBLIC_RECIPIENT" =~ ^age1[a-z0-9]{20,}$ ]] ||
 fail "Owner's public age recipient is not configured."
python3 - <<'PY' || fail "Source must be the existing main Neon direct TLS endpoint for both databases."
import os,re,urllib.parse
host=os.environ["NEON_EXPECTED_SOURCE_HOST"]
# Pin the original main endpoint identity audited in this repository in October 2026.
assert host=="ep-muddy-credit-awc80y8f.c-12.us-east-1.aws.neon.tech"
for name in ("neondb","litixapi"):
 u=urllib.parse.urlsplit(os.environ["NEON_DIRECT_URL_"+name.upper()])
 assert u.scheme in ("postgres","postgresql") and u.hostname==host and u.path=="/"+name
 assert not (u.fragment or u.username is None or u.password is None)
 assert urllib.parse.parse_qs(u.query).get("sslmode")==["require"]
 assert "-pooler" not in u.hostname
PY

# The owner's PRIVATE recovery key is never available to the GitHub runner.
# Multi-recipient encryption permits the owner to decrypt retained R2 objects,
# while a newly generated short-lived identity permits one-time restore testing.
age-keygen -o "$work/temporary-ci-restore-key" >/dev/null 2>&1 ||
 fail "Could not create transient restore key."
chmod 600 "$work/temporary-ci-restore-key"
test_public="$(age-keygen -y "$work/temporary-ci-restore-key")"
[[ "$test_public" == age1* ]] || fail "Temporary test key invalid."
image_name="postgres:18-alpine"
docker pull "$image_name" >"$work/image-pull.status" 2>&1 ||
 fail "PostgreSQL 18 image unavailable."
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
for db in neondb litixapi;do
 echo "BACKUP_DATABASE_START=$db"
 case "$db" in
  neondb) export LITIX_READONLY_PG_URL="$NEON_DIRECT_URL_NEONDB" ;;
  litixapi) export LITIX_READONLY_PG_URL="$NEON_DIRECT_URL_LITIXAPI" ;;
 esac
 filename="litix-neon-$db-production-$timestamp-${GITHUB_RUN_ID:-0}.pgcustom.age"
 object="litix-production/$db/$filename"
 encrypted="$work/$filename"
 # Use PG18 in an isolated short-lived container. Pass the secret URL only as
 # a named ENV variable (not argv), and suppress raw Postgres output on failures.
 python3 scripts/litix-r2-readonly-pgdump.py  2>"$work/pgdump-$db.err" |
  age --recipient "$AGE_PUBLIC_RECIPIENT" --recipient "$test_public" --output "$encrypted" \
  2>"$work/age-$db.err" ||
  fail "$db pg_dump or age encryption failed; no DB changes were made."
 unset LITIX_READONLY_PG_URL
 [[ -s "$encrypted" ]] || fail "$db ciphertext is empty."
 local_sha="$(sha256sum "$encrypted" | awk '{print $1}')"
 local_size="$(wc -c < "$encrypted" | tr -d '[:space:]')"
 python3 scripts/litix-r2-boto3-transfer.py upload "$object" "$encrypted" \
  >"$work/upload-$db.status" 2>"$work/upload-$db.err" ||
  fail "$db encrypted R2 upload failed."
 remote_size="$(python3 scripts/litix-r2-boto3-transfer.py head "$object" 2>"$work/size-$db.err")" ||
  fail "$db remote R2 object metadata not retrievable."
 [[ "$remote_size" == "$local_size" ]] || fail "$db remote R2 object size mismatch."
 python3 scripts/litix-r2-boto3-transfer.py get "$object" "$work/$db.download.age" \
  >"$work/download-$db.status" 2>"$work/download-$db.err" ||
  fail "$db cannot download encrypted R2 object."
 cmp -s "$encrypted" "$work/$db.download.age" || fail "$db remote ciphertext byte comparison failed."
 [[ "$local_sha" == "$(sha256sum "$work/$db.download.age" | awk '{print $1}')" ]] ||
  fail "$db R2 roundtrip SHA256 mismatch."
 echo "ACTUAL_ENCRYPTED_R2_BACKUP_PASS=$db"
 echo "R2_OBJECT=s3://litix-private-backups/$object"
 echo "R2_CIPHERTEXT_SHA256=$local_sha"
 
 # Independently inspect and decrypt the DOWNLOADED ciphertext. Decrypted data
 # is only streamed into a disconnected temporary PostgreSQL 18 container.
 age --decrypt --identity "$work/temporary-ci-restore-key" "$work/$db.download.age" \
  2>"$work/decrypt-manifest-$db.err" |
  docker run --rm -i --network none "$image_name" pg_restore --list >"$work/$db.toc" \
  2>"$work/pgrestore-manifest-$db.err" ||
  fail "$db encrypted custom archive is not decryptable / parseable."
 case "$db" in
  neondb) tables=(litix_v2_orders litix_boostero_fulfillment litix_growth_bundle_orders);;
  litixapi) tables=(packages checkouts fulfillment_outbox);;
 esac
 for table in "${tables[@]}";do
  grep -Eq "TABLE DATA +public +$table " "$work/$db.toc" ||
   fail "$db archive is missing $table data."
 done
 current_container="litix-r2-check-$db-${GITHUB_RUN_ID:-0}"
 docker run --rm -d --network none --name "$current_container" \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB="$db" "$image_name" \
  >"$work/container-$db.status" 2>&1 ||
  fail "$db isolated restore container did not start."
 ready=false
 for n in $(seq 1 60);do
  if docker exec "$current_container" pg_isready -h 127.0.0.1 -U postgres -d "$db" >/dev/null 2>&1;then ready=true;break;fi
  sleep 1
 done
 [[ "$ready" == true ]] || fail "$db isolated database failed readiness."
 age --decrypt --identity "$work/temporary-ci-restore-key" "$work/$db.download.age" \
  2>"$work/decrypt-restore-$db.err" |
  docker exec -i "$current_container" pg_restore -U postgres -d "$db" \
  --exit-on-error --single-transaction --no-owner --no-acl \
  >"$work/restore-$db.out" 2>"$work/restore-$db.err" ||
  fail "$db isolated PostgreSQL restore failed."
 # Verify core business tables really contain readable records, without ever
 # emitting customer data, PII, even row counts into PUBLIC Action logs.
 for table in "${tables[@]}";do
  [[ "$(docker exec "$current_container" psql -h 127.0.0.1 -U postgres -d "$db" \
   -X -q -t -A -v ON_ERROR_STOP=1 \
   -c "SELECT to_regclass('public.$table') IS NOT NULL" 2>"$work/table-$db.err" | tr -d '[:space:]')" == t ]] ||
   fail "$db restored required table missing: $table"
  docker exec "$current_container" psql -h 127.0.0.1 -U postgres -d "$db" \
   -X -q -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.$table" \
   >"$work/table-count-$db.out" 2>"$work/count-$db.err" ||
   fail "$db restored table unreadable: $table"
 done
 docker rm -f -v "$current_container" >"$work/remove-$db.status" 2>&1 ||
  fail "$db restore container failed to clean up."
 current_container=""
 echo "ACTUAL_ISOLATED_PG18_RESTORE_PASS=$db"
done
echo "ACTUAL_R2_BACKUP_BOTH_DBS_AND_RESTORES_PASS"
echo "LONG_TERM_RECOVERY_PRIVATE_AGE_KEY_NOT_PRESENT_IN_GITHUB"
