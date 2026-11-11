BEGIN;
CREATE SCHEMA IF NOT EXISTS growth_ops;

CREATE TABLE IF NOT EXISTS growth_ops.wholesale_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name VARCHAR(128) NOT NULL,
  token_sha256 CHAR(64) UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wholesale_partner_name_nonempty CHECK (length(trim(display_name)) BETWEEN 1 AND 128),
  CONSTRAINT wholesale_partner_token_hash CHECK (
    token_sha256 IS NULL OR token_sha256 ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE IF NOT EXISTS growth_ops.wholesale_wallet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES growth_ops.wholesale_partners(id),
  event_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('verified_funding','authorized_debit','verified_refund','manual_correction')),
  amount_cents BIGINT NOT NULL CHECK(amount_cents <> 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
  verified_reference TEXT NOT NULL CHECK(length(verified_reference) BETWEEN 8 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(partner_id, event_key),
  CONSTRAINT wholesale_wallet_event_key CHECK (length(event_key) BETWEEN 8 AND 160),
  CONSTRAINT wholesale_wallet_funding_positive CHECK (
    (kind IN ('verified_funding','verified_refund') AND amount_cents > 0) OR
    (kind = 'authorized_debit' AND amount_cents < 0) OR
    (kind = 'manual_correction')
  )
);

CREATE VIEW growth_ops.wholesale_wallet_balances AS
SELECT p.id AS partner_id,
       COALESCE(SUM(e.amount_cents),0)::bigint AS available_cents
FROM growth_ops.wholesale_partners p
LEFT JOIN growth_ops.wholesale_wallet_entries e ON e.partner_id = p.id
GROUP BY p.id;

CREATE TABLE IF NOT EXISTS growth_ops.wholesale_delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES growth_ops.wholesale_partners(id),
  source_order_id TEXT NOT NULL UNIQUE CHECK (length(source_order_id) BETWEEN 8 AND 160),
  kind TEXT NOT NULL CHECK(kind IN ('website_preview','owned_app_qa')),
  requested_units INTEGER NOT NULL CHECK (requested_units BETWEEN 1 AND 1000000),
  observed_units INTEGER NOT NULL DEFAULT 0 CHECK(observed_units BETWEEN 0 AND 1000000),
  verified_payment_ref TEXT,
  approval_state TEXT NOT NULL DEFAULT 'pending'
    CHECK(approval_state IN ('pending','approved','suspended')),
  delivery_state TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(delivery_state IN ('PENDING','IN_PROGRESS','PARTIAL','NEEDS_REVIEW','AWAITING_VERIFICATION','COMPLETED')),
  evidence_sha256 CHAR(64),
  last_observed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wholesale_paid_approval_required CHECK (
    approval_state <> 'approved' OR verified_payment_ref IS NOT NULL
  ),
  CONSTRAINT wholesale_delivery_evidence_hash CHECK (
    evidence_sha256 IS NULL OR evidence_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT wholesale_units_not_overstated CHECK (observed_units <= requested_units)
);

CREATE TABLE IF NOT EXISTS growth_ops.wholesale_delivery_events (
  event_id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES growth_ops.wholesale_delivery_orders(id),
  observed_units INTEGER NOT NULL CHECK(observed_units BETWEEN 0 AND 1000000),
  evidence_sha256 CHAR(64),
  observed_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wholesale_event_hash CHECK (
    evidence_sha256 IS NULL OR evidence_sha256 ~ '^[0-9a-f]{64}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_wholesale_order_review
  ON growth_ops.wholesale_delivery_orders(delivery_state, updated_at);
CREATE INDEX IF NOT EXISTS idx_wholesale_delivery_time
  ON growth_ops.wholesale_delivery_events(order_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_wholesale_wallet_partner
  ON growth_ops.wholesale_wallet_entries(partner_id, created_at DESC);

COMMIT;
