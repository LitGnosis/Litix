-- AutoLikes-only receipt outbox: one email attempt per independently settled NMI payment.
-- No changes to existing one-time checkout or receipts.
CREATE TABLE IF NOT EXISTS litix_autolikes_receipt_attempts (
  event_id text PRIMARY KEY REFERENCES litix_autolikes_live_gateway_events(event_id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'CLAIMED' CHECK (state IN ('CLAIMED','SENT','UNKNOWN_OUTCOME')),
  provider_email_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS litix_autolikes_receipt_attempts_state_idx
  ON litix_autolikes_receipt_attempts(state,created_at);
ALTER TABLE litix_autolikes_receipt_attempts ENABLE ROW LEVEL SECURITY;
