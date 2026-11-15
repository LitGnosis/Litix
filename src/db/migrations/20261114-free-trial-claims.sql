-- Free-trial claims are one-way. A network-ambiguous supplier add is NEVER retried.
-- Apply to a verified staging branch before enabling the trial gates.
BEGIN;
CREATE TABLE IF NOT EXISTS public.litix_free_trial_claims(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 platform text NOT NULL CHECK(platform IN ('instagram','tiktok')),
 kind text NOT NULL CHECK(kind IN ('likes','views')),
 profile_handle text NOT NULL,
 email text NOT NULL,
 destination text NOT NULL,
 ip_hash char(64) NOT NULL CHECK(ip_hash ~ '^[a-f0-9]{64}$'),
 email_hash char(64) NOT NULL CHECK(email_hash ~ '^[a-f0-9]{64}$'),
 profile_hash char(64) NOT NULL CHECK(profile_hash ~ '^[a-f0-9]{64}$'),
 marketing_consent boolean NOT NULL DEFAULT false,
 state text NOT NULL DEFAULT 'CLAIMED' CHECK(state IN
  ('CLAIMED','DISPATCHING','SUBMITTED','REJECTED','UNKNOWN_OUTCOME')),
 supplier_order_id text UNIQUE,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS litix_trial_ip_recent ON public.litix_free_trial_claims(ip_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS litix_trial_email_recent ON public.litix_free_trial_claims(email_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS litix_trial_profile_recent ON public.litix_free_trial_claims(profile_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS litix_trial_status ON public.litix_free_trial_claims(state,updated_at);
CREATE OR REPLACE FUNCTION public.litix_claim_free_trial(
 p_platform text,p_kind text,p_handle text,p_email text,p_destination text,
 p_ip_hash char(64),p_email_hash char(64),p_profile_hash char(64),p_consent boolean
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
 IF p_platform NOT IN ('instagram','tiktok') OR p_kind NOT IN ('likes','views') OR
    p_ip_hash !~ '^[a-f0-9]{64}$' OR p_email_hash !~ '^[a-f0-9]{64}$' OR
    p_profile_hash !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'trial_validation_failed';
 END IF;
 -- Serialize the global daily cap AND all 3 individual dimensions.
 PERFORM pg_advisory_xact_lock(hashtextextended('litix-trial-global-daily-cap', 0));
 -- Multiple
 -- concurrent POSTs cannot bypass the 30-day eligibility window.
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-ip:' || p_ip_hash, 0));
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-email:' || p_email_hash, 0));
 PERFORM pg_advisory_xact_lock(hashtextextended('trial-profile:' || p_profile_hash, 0));
 IF EXISTS(
   SELECT 1 FROM public.litix_free_trial_claims
    WHERE created_at > now()-interval '30 days' AND
      (ip_hash=p_ip_hash OR email_hash=p_email_hash OR profile_hash=p_profile_hash)
 ) THEN RETURN NULL; END IF;
 -- Global promotional spend circuit breaker. No unattended unlimited claims.
 IF (SELECT count(*) FROM public.litix_free_trial_claims
    WHERE created_at > now()-interval '24 hours') >= 50 THEN RETURN NULL; END IF;
 INSERT INTO public.litix_free_trial_claims(
  platform,kind,profile_handle,email,destination,ip_hash,email_hash,profile_hash,marketing_consent
 ) VALUES (
  p_platform,p_kind,p_handle,p_email,p_destination,p_ip_hash,p_email_hash,p_profile_hash,coalesce(p_consent,false)
 ) RETURNING id INTO new_id;
 RETURN new_id;
END;$$;
COMMIT;
