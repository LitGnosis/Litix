BEGIN;
CREATE TABLE IF NOT EXISTS public.master_fulfillment_grants (
  order_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('website_preview','owned_app_qa')),
  verification_source TEXT NOT NULL CHECK(length(verification_source) BETWEEN 4 AND 160),
  verified_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.master_inbound_events (
  event_id TEXT PRIMARY KEY,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.master_execution_nodes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('compute','qa_device')),
  owned BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK(capacity BETWEEN 1 AND 32),
  affinity_key TEXT,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.master_node_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE REFERENCES public.master_fulfillment_grants(order_id),
  tenant_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('website_preview','owned_app_qa')),
  payload JSONB NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed','needs_review')),
  node_id TEXT REFERENCES public.master_execution_nodes(id),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  result JSONB,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  CONSTRAINT master_node_job_tenant_key CHECK(length(tenant_key) BETWEEN 2 AND 120),
  CONSTRAINT master_node_job_hash CHECK(payload_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS idx_master_jobs_dispatch ON public.master_node_jobs(status,node_id,created_at);
CREATE INDEX IF NOT EXISTS idx_master_jobs_expired ON public.master_node_jobs(lease_until) WHERE status='running';
CREATE TABLE IF NOT EXISTS public.master_private_artifacts (
  job_id UUID PRIMARY KEY REFERENCES public.master_node_jobs(id) ON DELETE RESTRICT,
  mime_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.master_network_probes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  egress_id TEXT NOT NULL,
  latency_ms INTEGER CHECK(latency_ms IS NULL OR latency_ms BETWEEN 0 AND 600000),
  healthy BOOLEAN NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_master_probes_recent ON public.master_network_probes(checked_at DESC);
COMMIT;
