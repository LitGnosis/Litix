-- Litix digital-products commerce schema proposal.
-- Review and apply as a deliberate database migration; this file is NOT auto-executed.
-- Keep digital product orders separate from social-growth supplier orders.

CREATE TABLE IF NOT EXISTS litix_digital_waitlist (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  email_hash char(64) NOT NULL UNIQUE,
  product_interest text NOT NULL CHECK (product_interest IN ('creator-launch-kit','social-growth-toolkit','agency-starter-pack','all')),
  consent_at timestamptz NOT NULL,
  unsubscribe_token_hash char(64) UNIQUE,
  unsubscribed_at timestamptz,
  source text NOT NULL DEFAULT 'digital-products',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS litix_digital_waitlist_created_idx
  ON litix_digital_waitlist (created_at DESC);


CREATE TABLE IF NOT EXISTS litix_digital_assets (
  product_id text PRIMARY KEY CHECK (product_id IN ('creator-launch-kit','social-growth-toolkit','agency-starter-pack')),
  version text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL CHECK (content_type = 'application/zip'),
  content_base64 text NOT NULL,
  sha256 char(64) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS litix_digital_orders (
  id text PRIMARY KEY,
  email text NOT NULL,
  product_id text NOT NULL,
  product_name text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  payment_state text NOT NULL DEFAULT 'pending'
    CHECK (payment_state IN ('pending','processing','paid','declined','review','refunded','partially_refunded','chargeback')),
  fulfillment_state text NOT NULL DEFAULT 'locked'
    CHECK (fulfillment_state IN ('locked','ready','delivered','revoked','review')),
  idempotency_key uuid NOT NULL UNIQUE,
  payment_transaction_id text UNIQUE,
  payment_gateway text NOT NULL,
  entitlement_token_hash text NOT NULL,
  download_count integer NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  max_downloads integer NOT NULL DEFAULT 5 CHECK (max_downloads > 0),
  entitlement_expires_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS litix_digital_orders_email_created_idx
  ON litix_digital_orders (email, created_at DESC);

CREATE INDEX IF NOT EXISTS litix_digital_orders_state_created_idx
  ON litix_digital_orders (payment_state, fulfillment_state, created_at);

CREATE TABLE IF NOT EXISTS litix_digital_payment_events (
  id bigserial PRIMARY KEY,
  order_id text NOT NULL REFERENCES litix_digital_orders(id),
  gateway_event_id text,
  event_type text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('accepted','ignored','failed','review')),
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_digest text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (gateway_event_id)
);

CREATE INDEX IF NOT EXISTS litix_digital_payment_events_order_idx
  ON litix_digital_payment_events (order_id, received_at DESC);

-- Do not store full card numbers, CVVs, raw payment tokens, or gateway secrets.
-- The entitlement token is generated randomly, shown only to the buyer, and stored as a hash.
-- Mark an order paid only after an authoritative gateway approval response has been validated.
-- Grant downloads only when payment_state='paid' and fulfillment_state='ready'.
-- Refunds/chargebacks must revoke entitlement access and be recorded in the audit trail.
