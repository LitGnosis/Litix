-- Additive review register for NEW Boostero order types.
-- Does not modify existing approved litix_boostero_services, checkout, orders or payment records.
-- An inventory record alone never authorizes purchase or supplier order submission.
CREATE TABLE IF NOT EXISTS public.litix_boostero_full_service_approvals (
  supplier_service_id text PRIMARY KEY REFERENCES public.litix_boostero_inventory(supplier_service_id),
  order_type text NOT NULL,
  approved_retail_per_1000_cents bigint,
  approved_wholesale_ceiling numeric(16,6),
  special_contract_verified boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT false,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT litix_full_services_verified_enable CHECK (
    enabled = false OR (
      reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND
      approved_wholesale_ceiling IS NOT NULL AND approved_wholesale_ceiling > 0 AND
      ((order_type = 'Default' AND approved_retail_per_1000_cents >= 500)
       OR (order_type <> 'Default' AND special_contract_verified))
    )
  )
);
CREATE INDEX IF NOT EXISTS litix_boostero_full_service_approvals_enabled_idx
 ON public.litix_boostero_full_service_approvals(enabled,order_type);
-- All approvals default DISABLED; no automatic enabling, deletes, migrations of
-- customer PII, payment changes or supplier API calls.
