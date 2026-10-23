-- Durable item-level dispatch ledger for Litix bulk orders.
-- Apply through the approved database migration workflow before enabling any fulfillment worker.
-- This migration does not enable payment capture or supplier dispatch.

create table if not exists litix_bulk_order_items (
  id text primary key,
  request_hash char(64) not null references litix_idempotency_records(request_hash) on delete restrict,
  workspace_id text not null references litix_workspaces(id) on delete restrict,
  row_number integer not null check (row_number > 0),
  service_id integer not null references litix_catalog_prices(service_id) on delete restrict,
  service_name text not null,
  target_url text not null,
  quantity integer not null check (quantity > 0),
  retail_rate_per_thousand numeric(18,6) not null check (retail_rate_per_thousand >= 0),
  line_total numeric(18,2) not null check (line_total >= 0),
  currency char(3) not null default 'USD' check (currency = 'USD'),
  state text not null default 'PENDING_PAYMENT_VERIFICATION'
    check (state in (
      'PENDING_PAYMENT_VERIFICATION',
      'PAYMENT_VERIFIED',
      'DISPATCH_PENDING',
      'DISPATCHING',
      'SUBMITTED',
      'PARTIAL_FAILURE_RECOVERY',
      'FAILED',
      'CANCELLED'
    )),
  supplier_order_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_at timestamptz,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_hash, row_number)
);

create index if not exists litix_bulk_order_items_recovery_idx
  on litix_bulk_order_items(state, updated_at)
  where state in ('DISPATCH_PENDING', 'PARTIAL_FAILURE_RECOVERY');

create index if not exists litix_bulk_order_items_workspace_idx
  on litix_bulk_order_items(workspace_id, created_at desc);

-- Immutable attempt journal: a timeout is ambiguous and must be reconciled before retrying.
create table if not exists litix_bulk_dispatch_attempts (
  id text primary key,
  item_id text not null references litix_bulk_order_items(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  supplier_name text not null,
  request_fingerprint char(64) not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  state text not null check (state in (
    'STARTED', 'CONFIRMED', 'REJECTED', 'UNKNOWN_OUTCOME', 'RECONCILED'
  )),
  supplier_order_id text,
  http_status integer,
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (item_id, attempt_number)
);

create index if not exists litix_bulk_dispatch_attempts_reconcile_idx
  on litix_bulk_dispatch_attempts(state, started_at)
  where state in ('STARTED', 'UNKNOWN_OUTCOME');
