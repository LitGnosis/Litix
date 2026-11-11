BEGIN;
CREATE SCHEMA IF NOT EXISTS growth_ops;
CREATE TABLE IF NOT EXISTS growth_ops.litix_owned_delivery_agreements (
  order_id TEXT PRIMARY KEY REFERENCES public.master_fulfillment_grants(order_id),
  kind TEXT NOT NULL CHECK(kind IN ('website_preview','owned_app_qa')),
  client_order_id TEXT CHECK(client_order_id IS NULL OR length(client_order_id) BETWEEN 1 AND 120),
  target_units INTEGER NOT NULL CHECK(target_units BETWEEN 1 AND 1000000),
  endpoint_key TEXT CHECK(endpoint_key IS NULL OR endpoint_key ~ '^[a-z0-9_-]{3,64}$'),
  approval_state TEXT NOT NULL DEFAULT 'pending'
    CHECK(approval_state IN ('pending','approved','suspended')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT approved_requires_timestamp CHECK(approval_state <> 'approved' OR approved_at IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS growth_ops.litix_owned_delivery_events (
  event_id UUID PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES growth_ops.litix_owned_delivery_agreements(order_id),
  kind TEXT NOT NULL CHECK(kind IN ('website_preview','owned_app_qa')),
  reported_units INTEGER NOT NULL CHECK(reported_units BETWEEN 0 AND 1000000),
  evidence_ref TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_litix_owned_events_order_time
  ON growth_ops.litix_owned_delivery_events(order_id, observed_at DESC);
CREATE TABLE IF NOT EXISTS growth_ops.litix_owned_delivery_progress (
  order_id TEXT PRIMARY KEY REFERENCES growth_ops.litix_owned_delivery_agreements(order_id),
  reported_units INTEGER NOT NULL DEFAULT 0 CHECK(reported_units BETWEEN 0 AND 1000000),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','PARTIAL','NEEDS_REVIEW','AWAITING_VERIFICATION','COMPLETED')),
  remaining_units INTEGER NOT NULL DEFAULT 0 CHECK(remaining_units >= 0),
  last_observed_at TIMESTAMPTZ,
  evidence_ref TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS growth_ops.litix_owned_delivery_webhook_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES growth_ops.litix_owned_delivery_events(event_id),
  order_id TEXT NOT NULL REFERENCES growth_ops.litix_owned_delivery_agreements(order_id),
  endpoint_key TEXT NOT NULL CHECK(endpoint_key ~ '^[a-z0-9_-]{3,64}$'),
  payload JSONB NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','sending','retry','sent','dead')),
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 100),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, endpoint_key)
);
CREATE INDEX IF NOT EXISTS idx_litix_owned_webhook_due
 ON growth_ops.litix_owned_delivery_webhook_outbox(state, next_attempt_at, lease_until)
 WHERE state IN ('pending','retry','sending');
COMMIT;
