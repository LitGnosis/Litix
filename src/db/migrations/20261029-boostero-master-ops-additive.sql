-- Staged only. Apply AFTER verified recoverable backups for BOTH neondb and litixapi.
-- Requires 20261028-boostero-global-inventory-additive.sql first.
-- Inventory is private. Existing customer/order/payment tables untouched.
ALTER TABLE public.litix_boostero_inventory
 ADD COLUMN IF NOT EXISTS validation_state text NOT NULL DEFAULT 'IMPORTED';
ALTER TABLE public.litix_boostero_inventory
 ADD COLUMN IF NOT EXISTS validation_reason text;
ALTER TABLE public.litix_boostero_inventory
 ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
ALTER TABLE public.litix_boostero_inventory
 ADD COLUMN IF NOT EXISTS checkout_adapter text;
ALTER TABLE public.litix_boostero_inventory
 ADD CONSTRAINT litix_boostero_validation_state_check
 CHECK (validation_state IN ('IMPORTED','VERIFIED','PURCHASABLE','UNSUPPORTED_TYPE',
                            'INVALID_METADATA','SUPPLIER_UNAVAILABLE','DISCONTINUED','PENDING_REVIEW'));
CREATE INDEX IF NOT EXISTS litix_boostero_inventory_validation_idx
 ON public.litix_boostero_inventory(validation_state,active,refreshed_at DESC);
-- Sync operation logs contain only sanitized codes and aggregate counts.
CREATE TABLE IF NOT EXISTS public.litix_boostero_sync_events (
 event_id uuid PRIMARY KEY,
 run_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 event_level text NOT NULL CHECK(event_level IN ('INFO','WARN','ERROR')),
 operation text NOT NULL CHECK(operation IN (
  'SYNC_STARTED','SYNC_SUCCESS','SYNC_PARTIAL','VALIDATION_FAILED','SUPPLIER_ERROR',
  'CATALOG_PUBLISHED','RECOVERY_REQUIRED','SYNC_FAILED')),
 supplier_total integer NOT NULL DEFAULT 0 CHECK(supplier_total>=0),
 processed integer NOT NULL DEFAULT 0 CHECK(processed>=0),
 activated integer NOT NULL DEFAULT 0 CHECK(activated>=0),
 rejected integer NOT NULL DEFAULT 0 CHECK(rejected>=0),
 deactivated integer NOT NULL DEFAULT 0 CHECK(deactivated>=0),
 elapsed_ms integer CHECK(elapsed_ms IS NULL OR elapsed_ms>=0),
 error_code text,
 reason_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
 protected_incident boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS litix_boostero_events_recent_idx
 ON public.litix_boostero_sync_events(created_at DESC,event_id DESC);
CREATE INDEX IF NOT EXISTS litix_boostero_events_run_idx
 ON public.litix_boostero_sync_events(run_id,created_at DESC);
CREATE INDEX IF NOT EXISTS litix_boostero_events_retention_idx
 ON public.litix_boostero_sync_events(created_at)
 WHERE protected_incident=false AND event_level='INFO' AND operation IN ('SYNC_STARTED','SYNC_SUCCESS');
-- Append-only event creation. No automatic deletion, no destructive triggers,
-- no PII/wholesale details in owner responses, and no changes to bundle payments.

-- Cross-request sync lease. One active worker, crashes expire after five minutes.
CREATE TABLE IF NOT EXISTS public.litix_boostero_sync_lock (
 lock_id text PRIMARY KEY CHECK(lock_id='global'),
 run_id uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
