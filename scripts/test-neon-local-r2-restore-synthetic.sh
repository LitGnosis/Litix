#!/usr/bin/env bash
# Synthetic end-to-end local R2 restore with a fake AWS CLI and NO NETWORK.
set -euo pipefail
umask 077
for tool in docker age age-keygen sha256sum; do command -v "$tool" >/dev/null || exit 2; done
tmp="$(mktemp -d -t litix-local-r2-fixture.XXXXXXXX)"
source="litix-synth-src-$$"
cleanup(){ docker rm -f -v "$source" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
docker run -d --rm --network none --name "$source" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=neondb postgres:18-alpine >/dev/null
ready=false
for i in $(seq 1 60); do
 if docker exec "$source" pg_isready -h 127.0.0.1 -U postgres -d neondb >/dev/null 2>&1; then ready=true;break;fi
 sleep 1
done
[[ "$ready" == "true" ]] || exit 2
docker exec "$source" createdb -h 127.0.0.1 -U postgres litixapi
docker exec "$source" psql -h 127.0.0.1 -U postgres -d neondb -q -v ON_ERROR_STOP=1 -c \
"CREATE TABLE public.litix_v2_orders(id text PRIMARY KEY);
 CREATE TABLE public.litix_boostero_fulfillment(id text PRIMARY KEY);
 CREATE TABLE public.litix_growth_bundle_orders(id text PRIMARY KEY);
 INSERT INTO public.litix_v2_orders VALUES('fake-order');
 INSERT INTO public.litix_boostero_fulfillment VALUES('fake-fulfillment');
 INSERT INTO public.litix_growth_bundle_orders VALUES('fake-bundle');" >/dev/null
docker exec "$source" psql -h 127.0.0.1 -U postgres -d litixapi -q -v ON_ERROR_STOP=1 -c \
"CREATE TABLE public.packages(id text PRIMARY KEY);
 CREATE TABLE public.checkouts(id text PRIMARY KEY);
 CREATE TABLE public.fulfillment_outbox(id text PRIMARY KEY);
 INSERT INTO public.packages VALUES('fake-package');
 INSERT INTO public.checkouts VALUES('fake-checkout');
 INSERT INTO public.fulfillment_outbox VALUES('fake-outbox');" >/dev/null
age-keygen -o "$tmp/identity" >/dev/null 2>&1
public="$(grep '# public key:' "$tmp/identity" | awk '{print $4}')"
[[ "$public" == age1* ]] || exit 2
mkdir -p "$tmp/mock-aws" "$tmp/fake-bucket"
cat > "$tmp/mock-aws/aws" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == "--endpoint-url" && "$2" == https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com && "$3" == "s3" && "$4" == "cp" ]] || exit 87
[[ "$5" == s3://* ]] || exit 88
cp "$SYNTHETIC_R2_DIR/$(basename "$5")" "$6"
MOCK
chmod 700 "$tmp/mock-aws/aws"
export PATH="$tmp/mock-aws:$PATH"
export SYNTHETIC_R2_DIR="$tmp/fake-bucket"
for db in neondb litixapi; do
 name="litix-neon-$db-production-20261028T000000Z.pgcustom.age"
 docker exec "$source" pg_dump -h 127.0.0.1 -U postgres -d "$db" -Fc --no-owner --no-acl |
   age -r "$public" -o "$tmp/fake-bucket/$name"
 export BACKUP_STORAGE_PROVIDER=r2
 export BACKUP_S3_ENDPOINT_URL=https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com
 export BACKUP_R2_PRIVATE_BUCKET_CONFIRMED=I_VERIFIED_NO_PUBLIC_ACCESS
 export AWS_ACCESS_KEY_ID=mock-synthetic-only
 export AWS_SECRET_ACCESS_KEY=mock-synthetic-only
 export NEON_BACKUP_DATABASE="$db"
 export BACKUP_AGE_IDENTITY="$tmp/identity"
 export BACKUP_OBJECT_URI="s3://litix-synthetic-bucket/test/$name"
 export BACKUP_CIPHERTEXT_SHA256="$(sha256sum "$tmp/fake-bucket/$name" | awk '{print $1}')"
 export RESTORE_LOCAL_DOCKER_ACK=I_APPROVE_OFFLINE_DOCKER_RESTORE
 bash scripts/neon-restore-local-docker-r2.sh
done
echo "SYNTHETIC_R2_LOCAL_ISOLATED_RESTORE_PASS_BOTH_DATABASES"
