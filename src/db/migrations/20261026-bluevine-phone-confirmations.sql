-- Preserve historical customer_whatsapp and all PayKings data. Never backfill or delete old contacts.
ALTER TABLE public.litix_growth_bundle_orders
 ADD COLUMN IF NOT EXISTS phone_e164 text;
ALTER TABLE public.litix_growth_bundle_orders
 ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz;
-- consent null means no transactional SMS permission; never infer permission from purchasing.
