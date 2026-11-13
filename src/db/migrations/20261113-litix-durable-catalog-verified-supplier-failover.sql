-- Litix durable public catalog + explicitly verified 1st/2nd supplier routing.
-- Does not change pricing, existing purchases, supplier keys, or live dispatch.
BEGIN;

CREATE TABLE IF NOT EXISTS public.litix_public_catalog_snapshot (
  service_id text PRIMARY KEY CHECK (service_id ~ '^boostero_[0-9]{1,12}$'),
  card jsonb NOT NULL CHECK (jsonb_typeof(card)='object'),
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS litix_public_catalog_snapshot_recent
  ON public.litix_public_catalog_snapshot (observed_at DESC);

CREATE TABLE IF NOT EXISTS public.litix_verified_supplier_routes (
  litix_service_id text NOT NULL CHECK (litix_service_id ~ '^boostero_[0-9]{1,12}$'),
  supplier_code text NOT NULL CHECK(supplier_code IN ('SMMWIZ','JAP','PEAKERR')),
  supplier_service_id text NOT NULL CHECK (supplier_service_id ~ '^[0-9]{1,12}$'),
  priority smallint NOT NULL CHECK (priority IN (1,2)),
  enabled boolean NOT NULL DEFAULT false,
  owner_approved boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_source text,
  platform text NOT NULL,
  kind text NOT NULL,
  country_scope text NOT NULL DEFAULT 'unspecified',
  service_type text NOT NULL DEFAULT 'Default',
  min_quantity integer NOT NULL CHECK(min_quantity>0),
  max_quantity integer NOT NULL CHECK(max_quantity>=min_quantity),
  wholesale_rate_per_1000_usd numeric(14,6) NOT NULL CHECK(wholesale_rate_per_1000_usd>0),
  currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (litix_service_id,priority),
  UNIQUE (litix_service_id,supplier_code,supplier_service_id),
  CONSTRAINT litix_verified_supplier_routes_ready
    CHECK (NOT enabled OR (owner_approved AND verified_at IS NOT NULL
                       AND verified_source IS NOT NULL
                       AND length(trim(verified_source))>=3))
);
CREATE INDEX IF NOT EXISTS litix_verified_supplier_routes_eligible
  ON public.litix_verified_supplier_routes (litix_service_id,priority)
  WHERE enabled AND owner_approved AND verified_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.litix_supplier_failover_attempts (
  id uuid PRIMARY KEY,
  litix_order_id text NOT NULL REFERENCES public.litix_v2_orders(id) ON DELETE RESTRICT,
  supplier_code text NOT NULL CHECK(supplier_code IN ('SMMWIZ','JAP','PEAKERR')),
  supplier_service_id text NOT NULL CHECK(supplier_service_id ~ '^[0-9]{1,12}$'),
  attempt_no smallint NOT NULL CHECK(attempt_no IN(1,2)),
  state text NOT NULL CHECK(state IN('DISPATCHING','PROVIDER_REJECTED','SUBMITTED','UNKNOWN_OUTCOME')),
  supplier_order_id text,
  error_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(litix_order_id,attempt_no),
  UNIQUE(litix_order_id,supplier_code),
  CONSTRAINT litix_failover_acceptance CHECK (
    (state='SUBMITTED' AND nullif(supplier_order_id,'') IS NOT NULL)
    OR (state<>'SUBMITTED' AND supplier_order_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS litix_supplier_one_accepted_order
  ON public.litix_supplier_failover_attempts(litix_order_id)
  WHERE state='SUBMITTED';
COMMIT;

-- Do NOT auto-map Boostero IDs to SMMWiz, JAP or Peakerr IDs:
-- the external SKU numbers and service semantics are unrelated.
-- A route is eligible only after matching live source listings, quantity,
-- format, geography, wholesale ceiling and explicit owner approval.
-- Do NOT auto-replay historical paid/UNKNOWN_OUTCOME orders.
