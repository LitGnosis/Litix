-- Litix Guardian independent monitoring tables. No modifications to payment or order tables.
CREATE TABLE IF NOT EXISTS public.litix_guardian_components (
 component text PRIMARY KEY,
 status text NOT NULL DEFAULT 'unknown' CHECK(status IN ('healthy','degraded','down','unknown','not_launched')),
 consecutive_failures integer NOT NULL DEFAULT 0,
 consecutive_successes integer NOT NULL DEFAULT 0,
 checked_at timestamptz,
 last_healthy_at timestamptz,
 last_result jsonb NOT NULL DEFAULT '{}'::jsonb,
 active_incident_id text,
 alert_at timestamptz,
 escalation_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.litix_guardian_incidents (
 id text PRIMARY KEY,
 component text NOT NULL REFERENCES public.litix_guardian_components(component),
 started_at timestamptz NOT NULL DEFAULT now(),
 confirmed_at timestamptz,
 resolved_at timestamptz,
 severity text NOT NULL DEFAULT 'warning',
 cause_code text NOT NULL DEFAULT 'UNKNOWN',
 summary text NOT NULL DEFAULT '',
 last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS litix_guardian_incidents_recent
 ON public.litix_guardian_incidents(started_at DESC);
CREATE TABLE IF NOT EXISTS public.litix_guardian_alert_outbox (
 event_key text PRIMARY KEY,
 incident_id text NOT NULL,
 component text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('outage','escalation','recovery')),
 payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent')),
 attempts integer NOT NULL DEFAULT 0,
 last_attempt_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS litix_guardian_alert_queue
 ON public.litix_guardian_alert_outbox(status,created_at);
CREATE TABLE IF NOT EXISTS public.litix_guardian_runs (
 id text PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 component_count integer NOT NULL DEFAULT 0,
 unhealthy_count integer NOT NULL DEFAULT 0,
 diag jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS litix_guardian_runs_recent
 ON public.litix_guardian_runs(started_at DESC);
-- No customer email, token, supplier credential, or card data stored here.
