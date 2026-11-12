BEGIN;
CREATE SCHEMA IF NOT EXISTS growth_ops;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Retail card orders must be recorded before NMI is contacted, and never retried
-- after an ambiguous outcome. No supplier IDs, vendor fallbacks, or fake deliverables.
CREATE TABLE IF NOT EXISTS growth_ops.direct_retail_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 idempotency_key UUID NOT NULL UNIQUE,
 customer_email TEXT NOT NULL CHECK(length(customer_email) BETWEEN 5 AND 254),
 service_kind TEXT NOT NULL REFERENCES growth_ops.direct_service_catalog(service_kind),
 brief JSONB NOT NULL CHECK(jsonb_typeof(brief)='object'),
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 100 AND 1000000),
 currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 payment_state TEXT NOT NULL DEFAULT 'PROCESSING'
   CHECK(payment_state IN ('PROCESSING','APPROVED_PENDING_SETTLEMENT','SETTLED','DECLINED','REVIEW')),
 gateway_transaction_id TEXT UNIQUE,
 last_error_code TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_direct_retail_reconcile
 ON growth_ops.direct_retail_orders(payment_state,created_at)
 WHERE payment_state='APPROVED_PENDING_SETTLEMENT';

-- The existing TLS Redis publisher reads this durable first-party job ledger.
-- Exactly one queued job may exist for a settled retail order.
ALTER TABLE growth_ops.direct_fulfillment_jobs
 ADD COLUMN IF NOT EXISTS retail_order_id UUID UNIQUE
 REFERENCES growth_ops.direct_retail_orders(id);

COMMIT;
