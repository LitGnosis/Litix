-- AutoLikes supplier status only; additive and no payment or fulfillment writes.
ALTER TABLE litix_autolikes_live_posts ADD COLUMN IF NOT EXISTS supplier_status text;
ALTER TABLE litix_autolikes_live_posts ADD COLUMN IF NOT EXISTS supplier_remains integer;
ALTER TABLE litix_autolikes_live_posts ADD COLUMN IF NOT EXISTS last_status_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS litix_autolikes_live_status_sync_idx ON litix_autolikes_live_posts(last_status_checked_at,created_at) WHERE state='SUBMITTED' AND supplier_order_id IS NOT NULL;
