-- Apply on a Neon staging branch first. Additive; no payment or wallet state changes.
BEGIN;
CREATE TABLE IF NOT EXISTS litix_nmi_idempotency_store (
 order_id text PRIMARY KEY,
 request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK (state IN ('pending','succeeded','unknown')),
 response_cache jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS litix_nmi_provider_operations_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id text NOT NULL UNIQUE REFERENCES litix_nmi_idempotency_store(order_id),
 request_hash text NOT NULL,
 state text NOT NULL CHECK (state IN ('succeeded','unknown')),
 transaction_id text,
 manifest text,
 signature text,
 key_id text NOT NULL,
 encrypted_response text,
 created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
