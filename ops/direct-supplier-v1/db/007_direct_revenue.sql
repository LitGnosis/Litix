BEGIN;
CREATE SCHEMA IF NOT EXISTS growth_ops;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Payment records are not fulfillment evidence. All prices are USD and stored precisely.
CREATE TABLE IF NOT EXISTS growth_ops.child_panels (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_email TEXT NOT NULL,
 custom_domain TEXT UNIQUE NOT NULL,
 api_key_hash TEXT UNIQUE,
 wholesale_balance_usd NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(wholesale_balance_usd>=0),
 markup_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.60 CHECK(markup_multiplier BETWEEN 1.00 AND 20.00),
 subscription_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(subscription_status IN ('PENDING','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED')),
 nmi_subscription_id TEXT UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT child_panel_email_valid CHECK(length(owner_email) BETWEEN 5 AND 254 AND position('@' IN owner_email)>1),
 CONSTRAINT child_panel_domain_valid CHECK(custom_domain ~ '^[a-z0-9][a-z0-9.-]{2,252}[a-z0-9]$')
);
CREATE INDEX IF NOT EXISTS idx_child_panel_owner ON growth_ops.child_panels(lower(owner_email));

-- Tier 500: maximum 25 verified owned/authorized handles. Tier 1500: maximum 100.
-- Retainers cover creative operations and authorized monitoring, not purchased interactions.
CREATE TABLE IF NOT EXISTS growth_ops.agency_retainers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 agency_name TEXT NOT NULL CHECK(length(agency_name) BETWEEN 2 AND 160),
 owner_email TEXT NOT NULL,
 tier TEXT NOT NULL CHECK(tier IN ('AGENCY_500_WK','ENTERPRISE_1500_WK')),
 monitored_handles JSONB NOT NULL DEFAULT '[]'::jsonb,
 monthly_stream_quota INTEGER NOT NULL DEFAULT 0 CHECK(monthly_stream_quota BETWEEN 0 AND 1000000),
 quota_used INTEGER NOT NULL DEFAULT 0 CHECK(quota_used>=0),
 subscription_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(subscription_status IN ('PENDING','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED')),
 nmi_subscription_id TEXT UNIQUE,
 consent_verified_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT agency_handles_array CHECK(jsonb_typeof(monitored_handles)='array'),
 CONSTRAINT agency_handles_tier_limit CHECK(jsonb_array_length(monitored_handles) <= CASE WHEN tier='AGENCY_500_WK' THEN 25 ELSE 100 END),
 CONSTRAINT agency_email_valid CHECK(length(owner_email) BETWEEN 5 AND 254 AND position('@' IN owner_email)>1),
 CONSTRAINT agency_quota_consistent CHECK(quota_used<=monthly_stream_quota)
);
CREATE INDEX IF NOT EXISTS idx_agency_active ON growth_ops.agency_retainers(subscription_status,updated_at);

-- Financial ledger: pending credit is not an approved payout.
CREATE TABLE IF NOT EXISTS growth_ops.affiliate_ledger (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 referrer_code TEXT NOT NULL CHECK(referrer_code ~ '^[A-Za-z0-9_-]{4,64}$'),
 referred_account_id UUID NOT NULL,
 source_payment_id TEXT NOT NULL CHECK(length(source_payment_id) BETWEEN 8 AND 160),
 commission_usd NUMERIC(12,2) NOT NULL CHECK(commission_usd>=0),
 payout_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(payout_status IN ('PENDING','APPROVED','PAID','REVERSED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 paid_at TIMESTAMPTZ,
 UNIQUE(referred_account_id,source_payment_id)
);

CREATE TABLE IF NOT EXISTS growth_ops.revenue_applications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_email TEXT NOT NULL,
 agency_name TEXT,
 custom_domain TEXT,
 tier TEXT NOT NULL CHECK(tier IN ('PANEL_149_WK','AGENCY_500_WK','ENTERPRISE_1500_WK')),
 referred_by TEXT,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','VERIFIED','DECLINED','CONVERTED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(owner_email,tier)
);

-- One event may be received repeatedly. It must never create a second subscription.
CREATE TABLE IF NOT EXISTS growth_ops.recurring_payment_events (
 provider TEXT NOT NULL CHECK(provider='nmi'),
 event_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 transaction_id TEXT NOT NULL,
 subscription_id TEXT NOT NULL,
 owner_email TEXT,
 tier TEXT,
 amount_cents INTEGER,
 payload_sha256 CHAR(64) NOT NULL,
 state TEXT NOT NULL DEFAULT 'AWAITING_VERIFIED_SETTLEMENT'
   CHECK(state IN ('AWAITING_VERIFIED_SETTLEMENT','ACTIVATED','REVIEW','DUPLICATE')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 processed_at TIMESTAMPTZ,
 PRIMARY KEY(provider,event_id)
);

-- Filled only by trusted settlement reconciler using NMI merchant inquiry, never by an inbound event.
CREATE TABLE IF NOT EXISTS growth_ops.verified_recurring_settlements (
 transaction_id TEXT PRIMARY KEY,
 provider TEXT NOT NULL CHECK(provider='nmi'),
 subscription_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
 settlement_reference TEXT NOT NULL UNIQUE,
 verified_by TEXT NOT NULL CHECK(length(verified_by)>=8),
 verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_events_pending ON growth_ops.recurring_payment_events(state,created_at);

CREATE TABLE IF NOT EXISTS growth_ops.child_panel_wallet_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 panel_id UUID NOT NULL REFERENCES growth_ops.child_panels(id),
 source_payment_id TEXT NOT NULL UNIQUE,
 amount_usd NUMERIC(12,2) NOT NULL CHECK(amount_usd>0),
 entry_type TEXT NOT NULL CHECK(entry_type IN ('CREDIT','DEBIT')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- First-party social content observations come from a connected, authorized owner
-- or a node with auditable signed evidence. Not from inferred engagement counts.
CREATE TABLE IF NOT EXISTS growth_ops.authorized_post_observations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 agency_id UUID NOT NULL REFERENCES growth_ops.agency_retainers(id),
 platform TEXT NOT NULL CHECK(platform IN ('instagram','tiktok','youtube','x','linkedin')),
 handle TEXT NOT NULL CHECK(length(handle) BETWEEN 2 AND 120),
 external_post_id TEXT NOT NULL CHECK(length(external_post_id) BETWEEN 4 AND 250),
 content_url TEXT NOT NULL CHECK(content_url ~ '^https://'),
 observed_at TIMESTAMPTZ NOT NULL,
 owner_consent_ref TEXT NOT NULL CHECK(length(owner_consent_ref) BETWEEN 8 AND 200),
 verified_source TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','QUEUED','REVIEW','PROCESSED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(platform,external_post_id,agency_id)
);

CREATE TABLE IF NOT EXISTS growth_ops.direct_fulfillment_jobs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 agency_id UUID REFERENCES growth_ops.agency_retainers(id),
 observation_id UUID UNIQUE REFERENCES growth_ops.authorized_post_observations(id),
 service_kind TEXT NOT NULL CHECK(service_kind IN ('creative_kit','post_monitoring','first_party_content_review')),
 node_name VARCHAR(64),
 request JSONB NOT NULL,
 status TEXT NOT NULL DEFAULT 'QUEUED'
   CHECK(status IN ('QUEUED','CLAIMED','ACKNOWLEDGED','COMPLETED','REVIEW','FAILED')),
 lease_until TIMESTAMPTZ,
 attempts INT NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 20),
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 accepted_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_direct_jobs_queued ON growth_ops.direct_fulfillment_jobs(status,lease_until,submitted_at);

-- Nodes must register with a public key (Ed25519); no cleartext API or private key in DB.
CREATE TABLE IF NOT EXISTS growth_ops.first_party_node_keys (
 node_name VARCHAR(64) PRIMARY KEY,
 ed25519_public_key_b64 TEXT NOT NULL,
 authorized_services TEXT[] NOT NULL DEFAULT ARRAY['creative_kit','post_monitoring','first_party_content_review'],
 enabled BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT node_key_services_nonempty CHECK(cardinality(authorized_services)>0)
);
CREATE TABLE IF NOT EXISTS growth_ops.direct_node_receipts (
 event_id UUID PRIMARY KEY,
 job_id UUID NOT NULL REFERENCES growth_ops.direct_fulfillment_jobs(id),
 node_name VARCHAR(64) NOT NULL REFERENCES growth_ops.first_party_node_keys(node_name),
 evidence_sha256 CHAR(64) NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 observed_units INTEGER NOT NULL CHECK(observed_units BETWEEN 0 AND 1000000),
 signed_at TIMESTAMPTZ NOT NULL,
 accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 signature_b64 TEXT NOT NULL,
 UNIQUE(job_id,event_id)
);

ALTER TABLE growth_ops.direct_fulfillment_jobs
 ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS growth_ops.direct_job_artifacts (
 job_id UUID PRIMARY KEY REFERENCES growth_ops.direct_fulfillment_jobs(id) ON DELETE RESTRICT,
 mime_type TEXT NOT NULL DEFAULT 'application/json',
 content TEXT NOT NULL CHECK(length(content)<=250000),
 sha256 CHAR(64) NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}
CREATE TABLE IF NOT EXISTS growth_ops.direct_release_gates (
 id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(id=TRUE),
 merchant_settlement_verified BOOLEAN NOT NULL DEFAULT FALSE,
 fulfillment_capacity_verified BOOLEAN NOT NULL DEFAULT FALSE,
 recurring_checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO growth_ops.direct_release_gates(id) VALUES(TRUE) ON CONFLICT(id) DO NOTHING;
-- The revenue migration can bootstrap an empty database as well as upgrade production.
CREATE TABLE IF NOT EXISTS growth_ops.first_party_nodes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 node_name VARCHAR(64) NOT NULL UNIQUE,
 endpoint_or_serial VARCHAR(128) NOT NULL,
 node_type VARCHAR(32) NOT NULL DEFAULT 'FIRST_PARTY_COMPUTE',
 status VARCHAR(32) NOT NULL DEFAULT 'REGISTERED'
  CHECK(status IN ('REGISTERED','ONLINE','OFFLINE','SUSPENDED')),
 max_concurrency INT NOT NULL DEFAULT 1 CHECK(max_concurrency BETWEEN 1 AND 100),
 last_heartbeat TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS growth_ops.panel_credential_delivery (
 panel_id UUID PRIMARY KEY REFERENCES growth_ops.child_panels(id) ON DELETE CASCADE,
 encrypted_key BYTEA NOT NULL CHECK(octet_length(encrypted_key)>40),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE growth_ops.recurring_payment_events
 ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES growth_ops.revenue_applications(id);
CREATE INDEX IF NOT EXISTS idx_recurring_application ON growth_ops.recurring_payment_events(application_id,state,event_type);

CREATE TABLE IF NOT EXISTS growth_ops.direct_node_nonces (
 node_name VARCHAR(64) NOT NULL REFERENCES growth_ops.first_party_node_keys(node_name),
 nonce CHAR(48) NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(node_name,nonce)
);
CREATE INDEX IF NOT EXISTS idx_direct_node_nonce_expiration ON growth_ops.direct_node_nonces(occurred_at);

-- Revenue activation only grants the approved creative/monitoring service, never fake reach.
CREATE TABLE IF NOT EXISTS growth_ops.direct_service_catalog (
 service_kind TEXT PRIMARY KEY CHECK(service_kind IN ('creative_kit','post_monitoring','first_party_content_review')),
 billable BOOLEAN NOT NULL DEFAULT FALSE,
 first_party_only BOOLEAN NOT NULL DEFAULT TRUE,
 available BOOLEAN NOT NULL DEFAULT FALSE,
 service_description TEXT NOT NULL
);
INSERT INTO growth_ops.direct_service_catalog(service_kind,billable,first_party_only,available,service_description)
VALUES
('creative_kit',FALSE,TRUE,TRUE,'12 original editable creative drafts delivered by Litix'),
('post_monitoring',FALSE,TRUE,FALSE,'Authorized post detection and notification; pending connected owned sources'),
('first_party_content_review',FALSE,TRUE,FALSE,'Human-verified content quality review')
ON CONFLICT(service_kind) DO NOTHING;

COMMIT;
),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global gate is OFF until production NMI callback, delivery and rollback are independently verified.
CREATE TABLE IF NOT EXISTS growth_ops.direct_release_gates (
 id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(id=TRUE),
 merchant_settlement_verified BOOLEAN NOT NULL DEFAULT FALSE,
 fulfillment_capacity_verified BOOLEAN NOT NULL DEFAULT FALSE,
 recurring_checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO growth_ops.direct_release_gates(id) VALUES(TRUE) ON CONFLICT(id) DO NOTHING;
-- The revenue migration can bootstrap an empty database as well as upgrade production.
CREATE TABLE IF NOT EXISTS growth_ops.first_party_nodes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 node_name VARCHAR(64) NOT NULL UNIQUE,
 endpoint_or_serial VARCHAR(128) NOT NULL,
 node_type VARCHAR(32) NOT NULL DEFAULT 'FIRST_PARTY_COMPUTE',
 status VARCHAR(32) NOT NULL DEFAULT 'REGISTERED'
  CHECK(status IN ('REGISTERED','ONLINE','OFFLINE','SUSPENDED')),
 max_concurrency INT NOT NULL DEFAULT 1 CHECK(max_concurrency BETWEEN 1 AND 100),
 last_heartbeat TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS growth_ops.panel_credential_delivery (
 panel_id UUID PRIMARY KEY REFERENCES growth_ops.child_panels(id) ON DELETE CASCADE,
 encrypted_key BYTEA NOT NULL CHECK(octet_length(encrypted_key)>40),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE growth_ops.recurring_payment_events
 ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES growth_ops.revenue_applications(id);
CREATE INDEX IF NOT EXISTS idx_recurring_application ON growth_ops.recurring_payment_events(application_id,state,event_type);

CREATE TABLE IF NOT EXISTS growth_ops.direct_node_nonces (
 node_name VARCHAR(64) NOT NULL REFERENCES growth_ops.first_party_node_keys(node_name),
 nonce CHAR(48) NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(node_name,nonce)
);
CREATE INDEX IF NOT EXISTS idx_direct_node_nonce_expiration ON growth_ops.direct_node_nonces(occurred_at);

-- Revenue activation only grants the approved creative/monitoring service, never fake reach.
CREATE TABLE IF NOT EXISTS growth_ops.direct_service_catalog (
 service_kind TEXT PRIMARY KEY CHECK(service_kind IN ('creative_kit','post_monitoring','first_party_content_review')),
 billable BOOLEAN NOT NULL DEFAULT FALSE,
 first_party_only BOOLEAN NOT NULL DEFAULT TRUE,
 available BOOLEAN NOT NULL DEFAULT FALSE,
 service_description TEXT NOT NULL
);
INSERT INTO growth_ops.direct_service_catalog(service_kind,billable,first_party_only,available,service_description)
VALUES
('creative_kit',FALSE,TRUE,TRUE,'12 original editable creative drafts delivered by Litix'),
('post_monitoring',FALSE,TRUE,FALSE,'Authorized post detection and notification; pending connected owned sources'),
('first_party_content_review',FALSE,TRUE,FALSE,'Human-verified content quality review')
ON CONFLICT(service_kind) DO NOTHING;

COMMIT;
