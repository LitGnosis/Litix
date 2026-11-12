-- Litix Boostero ledger FK repair, applied to production Neon on 2026-11-12.
-- Problem: the legacy litix_boostero_services table contained only four
-- approved historic IDs, but the live Boostero catalog has many more.
-- Every newer ID failed the fulfillment FK before payment or dispatch.
--
-- Keep the legacy approvals, prices, and their constraints unchanged.
-- This new registry only records service IDs independently verified against
-- the live supplier catalog by boosteroOrderHandler.mjs.
-- This is NOT a payment authorization or supplier approval list.
--
-- All statements are transactionally applied; no historical orders deleted.
BEGIN;

CREATE TABLE IF NOT EXISTS public.litix_boostero_service_registry (
 supplier_service_id text PRIMARY KEY
  CHECK (supplier_service_id ~ '^[0-9]{1,12}$'),
 verified_first_seen_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.litix_boostero_service_registry(supplier_service_id)
SELECT supplier_service_id FROM public.litix_boostero_services
UNION SELECT supplier_service_id FROM public.litix_boostero_fulfillment
ON CONFLICT (supplier_service_id) DO NOTHING;

ALTER TABLE public.litix_boostero_fulfillment
 DROP CONSTRAINT IF EXISTS litix_boostero_fulfillment_supplier_service_id_fkey,
 ADD CONSTRAINT litix_boostero_fulfillment_supplier_service_id_fkey
  FOREIGN KEY (supplier_service_id)
  REFERENCES public.litix_boostero_service_registry(supplier_service_id)
  ON DELETE RESTRICT;

COMMIT;

-- Verification:
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conname='litix_boostero_fulfillment_supplier_service_id_fkey';
--
-- Owner wallet and PayKings purchases must still pass live supplier quoting,
-- balance/collect-token authorization, idempotency and full payment checks.
-- Admin-only wholesale rates are not shown in public customer catalog.
