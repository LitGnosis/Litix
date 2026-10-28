#!/usr/bin/env bash
# Only synthetic data. Run against disposable PostgreSQL 18 containers.
set -euo pipefail
umask 077
for tool in docker age age-keygen sha256sum mktemp; do command -v "$tool" >/dev/null || { echo "MISSING_TEST_TOOL: $tool"; exit 2; }; done
scratch="$(mktemp -d -t litix-synthetic-recovery.XXXXXXXX)"
source_name="litix-synth-source-$$"
target_name="litix-synth-target-$$"
cleanup(){ docker rm -f "$source_name" "$target_name" >/dev/null 2>&1 || true; rm -rf -- "$scratch"; }
trap cleanup EXIT
docker run -d --rm --name "$source_name" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=neondb postgres:18-alpine >/dev/null
docker run -d --rm --name "$target_name" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=neondb postgres:18-alpine >/dev/null
for container in "$source_name" "$target_name"; do
  ready=0
  for tick in $(seq 1 65); do
    if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -d neondb >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
  done
  [[ "$ready" == "1" ]] || { echo "POSTGRES18_CONTAINER_NOT_READY"; exit 2; }
done
docker exec "$source_name" createdb -h 127.0.0.1 -U postgres litixapi
docker exec "$target_name" createdb -h 127.0.0.1 -U postgres litixapi
docker exec "$source_name" psql -h 127.0.0.1 -U postgres -d neondb -v ON_ERROR_STOP=1 -q -c \
"CREATE TABLE public.litix_v2_orders(id text PRIMARY KEY,payment_transaction_id text UNIQUE,amount_cents integer);
 CREATE TABLE public.litix_boostero_fulfillment(litix_order_id text PRIMARY KEY,state text);
 CREATE TABLE public.litix_growth_bundle_orders(id text PRIMARY KEY,payment_state text);
 INSERT INTO public.litix_v2_orders VALUES('synthetic-order','synthetic-transaction',501);
 INSERT INTO public.litix_boostero_fulfillment VALUES('synthetic-order','SUBMITTED');
 INSERT INTO public.litix_growth_bundle_orders VALUES('synthetic-bundle','awaiting_payment');" >/dev/null
docker exec "$source_name" psql -h 127.0.0.1 -U postgres -d litixapi -v ON_ERROR_STOP=1 -q -c \
"CREATE TABLE public.packages(id text PRIMARY KEY);
 CREATE TABLE public.checkouts(id text PRIMARY KEY,package_id text);
 CREATE TABLE public.fulfillment_outbox(id text PRIMARY KEY,status text);
 INSERT INTO public.packages VALUES('synthetic-package');
 INSERT INTO public.checkouts VALUES('synthetic-checkout','synthetic-package');
 INSERT INTO public.fulfillment_outbox VALUES('synthetic-task','waiting');" >/dev/null
age-keygen -o "$scratch/identity" >/dev/null 2>&1
public_key="$(grep -i '# public key:' "$scratch/identity" | awk '{print $4}')"
[[ "$public_key" == age1* ]] || { echo "TEST_IDENTITY_INVALID"; exit 2; }
for db in neondb litixapi; do
  cipher="$scratch/$db.pgcustom.age"
  docker exec "$source_name" pg_dump -h 127.0.0.1 -U postgres -d "$db" --format=custom --no-owner --no-acl |
    age --recipient "$public_key" --output "$cipher"
  [[ -s "$cipher" ]] || { echo "SYNTHETIC_ENCRYPTION_FAILED"; exit 2; }
  sha256sum "$cipher" >"$scratch/$db.sha256"
  sha256sum --check --status "$scratch/$db.sha256"
  age --decrypt -i "$scratch/identity" "$cipher" | docker exec -i "$target_name" pg_restore -h 127.0.0.1 -U postgres -d "$db" --exit-on-error --single-transaction --no-owner --no-acl
  if [[ "$db" == "neondb" ]]; then tables=(litix_v2_orders litix_boostero_fulfillment litix_growth_bundle_orders); else tables=(packages checkouts fulfillment_outbox); fi
  for table in "${tables[@]}"; do
    original="$(docker exec "$source_name" psql -h 127.0.0.1 -U postgres -d "$db" -t -A -c "SELECT count(*) FROM public.$table")"
    restored="$(docker exec "$target_name" psql -h 127.0.0.1 -U postgres -d "$db" -t -A -c "SELECT count(*) FROM public.$table")"
    [[ "$original" == "1" && "$restored" == "$original" ]] || { echo "SYNTHETIC_RESTORE_TABLE_MISMATCH:$db:$table"; exit 2; }
  done
  echo "SYNTHETIC_ENCRYPTED_RESTORE_PASS:$db"
done
echo "SYNTHETIC_BOTH_DATABASES_VERIFIED_NO_CUSTOMER_DATA"
