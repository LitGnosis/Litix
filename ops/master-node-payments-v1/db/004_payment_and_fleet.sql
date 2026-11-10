BEGIN;
CREATE SCHEMA IF NOT EXISTS growth_ops;

CREATE TABLE IF NOT EXISTS growth_ops.litix_owned_payment_intents (
  order_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('nmi','stripe')),
  provider_transaction_id TEXT NOT NULL,
  expected_amount_cents INTEGER NOT NULL CHECK(expected_amount_cents>0),
  currency TEXT NOT NULL CHECK(currency='USD'),
  live_mode BOOLEAN NOT NULL DEFAULT TRUE,
  execution_approved BOOLEAN NOT NULL DEFAULT FALSE,
  service_kind TEXT NOT NULL CHECK(service_kind IN ('website_preview','owned_app_qa')),
  payload JSONB NOT NULL,
  tenant_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','awaiting_settlement','captured_needs_approval','dispatch_pending','requires_review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT litix_intent_provider_tx_unique UNIQUE(provider,provider_transaction_id),
  CONSTRAINT litix_intent_tenant_length CHECK(length(tenant_key) BETWEEN 2 AND 120)
);
CREATE TABLE IF NOT EXISTS growth_ops.litix_verified_payment_events (
  provider TEXT NOT NULL CHECK(provider IN ('nmi','stripe')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  order_id TEXT,
  transaction_id TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(provider,event_id)
);
CREATE TABLE IF NOT EXISTS growth_ops.litix_nmi_sale_receipts (
  order_id TEXT PRIMARY KEY REFERENCES growth_ops.litix_owned_payment_intents(order_id),
  transaction_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
  currency TEXT NOT NULL CHECK(currency='USD'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS growth_ops.litix_nmi_settled_transactions (
  transaction_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS growth_ops.litix_payment_dispatch_outbox (
  order_id TEXT PRIMARY KEY REFERENCES growth_ops.litix_owned_payment_intents(order_id),
  job_id UUID NOT NULL UNIQUE REFERENCES master_node_jobs(id),
  delivered_at TIMESTAMPTZ,
  lock_until TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_litix_payment_dispatch ON growth_ops.litix_payment_dispatch_outbox(delivered_at,lock_until,created_at);

CREATE TABLE IF NOT EXISTS growth_ops."LitixMobileProxy" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ipAddress" TEXT NOT NULL,
  "port" INTEGER NOT NULL CHECK("port" BETWEEN 1 AND 65535),
  "ispCarrier" TEXT NOT NULL,
  "latencyMs" INTEGER NOT NULL DEFAULT 0 CHECK("latencyMs" BETWEEN 0 AND 600000),
  "isCongested" BOOLEAN NOT NULL DEFAULT TRUE,
  "lastCheckedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS growth_ops."LitixHardwareNode" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "adbSerialId" TEXT NOT NULL UNIQUE,
  "isOnline" BOOLEAN NOT NULL DEFAULT FALSE,
  "activeOrderId" TEXT,
  "proxyId" TEXT REFERENCES growth_ops."LitixMobileProxy"("id") ON DELETE SET NULL,
  "cpuLoadPercent" INTEGER NOT NULL DEFAULT 0 CHECK("cpuLoadPercent" BETWEEN 0 AND 100),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_litix_owned_node_status ON growth_ops."LitixHardwareNode"("isOnline","updatedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_litix_mobile_proxy_health ON growth_ops."LitixMobileProxy"("isCongested","lastCheckedAt" DESC);
COMMIT;

-- Apply after 001_master_node.sql on an isolated staging branch with audited backup.
-- Execution approval and payment-intent registration belong only to the trusted checkout server.
-- An NMI successful authorization or sale is not settlement; no job starts until verified funds.
-- Do not grant untrusted web clients INSERT or UPDATE on this schema.
