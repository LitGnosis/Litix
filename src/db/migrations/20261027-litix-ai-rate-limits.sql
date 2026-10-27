-- LITIX AI quota ledger. Additive only: no existing payment, order, supplier, or Guardian tables are changed.
-- Apply to the database selected by LITIX_AI_DATABASE_URL (or existing Litix v2 DB fallback)
-- before enabling the AI chat. The endpoint fails closed if this table is absent.
CREATE TABLE IF NOT EXISTS public.litix_ai_request_limits (
  bucket_key text NOT NULL CHECK (length(bucket_key) <= 128),
  window_start timestamptz NOT NULL,
  requests integer NOT NULL DEFAULT 0 CHECK (requests >= 0),
  PRIMARY KEY (bucket_key, window_start)
);
COMMENT ON TABLE public.litix_ai_request_limits IS 'No chat text, email, IP, or order data: pseudonymous per-hour and global per-day request counts only.';
-- Periodic cleanup may be performed by a privileged maintenance process; no new cron is added.
