-- Litix platform foundation. Review and back up the database before applying.
create table if not exists litix_workspaces (id text primary key,name text not null,slug text not null unique,plan text not null default 'starter' check(plan in ('starter','creator','agency','business','enterprise')),status text not null default 'active' check(status in ('active','suspended','closed')),created_at timestamptz not null default now());
create table if not exists litix_workspace_members (workspace_id text not null references litix_workspaces(id) on delete cascade,user_id text not null,role text not null check(role in ('owner','admin','manager','analyst','operator','viewer')),monthly_budget_cents bigint check(monthly_budget_cents is null or monthly_budget_cents>=0),created_at timestamptz not null default now(),primary key(workspace_id,user_id));
create table if not exists litix_client_profiles (id text primary key,workspace_id text not null references litix_workspaces(id) on delete cascade,folder_id text,display_name text not null,platform text not null check(platform in ('instagram','tiktok','youtube','website','other')),profile_url text,created_by text not null,created_at timestamptz not null default now());
create index if not exists litix_client_profiles_workspace_idx on litix_client_profiles(workspace_id,created_at desc);
create table if not exists litix_tenant_domains (hostname text primary key,tenant_slug text not null,display_name text not null,theme jsonb not null default '{}'::jsonb,status text not null default 'pending' check(status in ('pending','active','suspended')),verification_token_hash text,verified_at timestamptz,created_at timestamptz not null default now());
create table if not exists litix_profile_watchers (id text primary key,workspace_id text not null references litix_workspaces(id) on delete cascade,platform text not null check(platform in ('instagram','tiktok','youtube')),profile_handle text not null,consent_at timestamptz,enabled boolean not null default false,created_at timestamptz not null default now(),unique(workspace_id,platform,profile_handle));
create table if not exists litix_profile_events (event_id text primary key,workspace_id text not null references litix_workspaces(id) on delete cascade,platform text not null,profile_handle text not null,post_url text not null,media_hash text not null,state text not null default 'queued' check(state in ('queued','review','processed','ignored','failed')),received_at timestamptz not null default now(),processed_at timestamptz);
create index if not exists litix_profile_events_queue_idx on litix_profile_events(state,received_at);
create table if not exists litix_bulk_batches (id text primary key,workspace_id text not null references litix_workspaces(id) on delete cascade,created_by text not null,state text not null default 'draft' check(state in ('draft','validated','approved','processing','completed','cancelled','review')),row_count integer not null default 0 check(row_count between 0 and 500),estimated_total_cents bigint check(estimated_total_cents is null or estimated_total_cents>=0),approved_by text,approved_at timestamptz,created_at timestamptz not null default now());
create table if not exists litix_bulk_batch_rows (batch_id text not null references litix_bulk_batches(id) on delete cascade,row_number integer not null,target_url text not null,quantity integer not null check(quantity>0),cluster_token_hash text not null,state text not null default 'pending' check(state in ('pending','validated','rejected','submitted','review')),error_code text,created_at timestamptz not null default now(),primary key(batch_id,row_number));

-- Persistent importer pricing and idempotency records. Retail prices are server-owned.
create table if not exists litix_catalog_prices (
  service_id integer primary key,
  service_name text not null,
  base_rate numeric(18,6) not null check (base_rate >= 0),
  retail_rate numeric(18,6) not null check (retail_rate >= 0),
  updated_at timestamptz not null default now(),
  constraint litix_catalog_markup_check check (retail_rate >= base_rate)
);
create table if not exists litix_idempotency_records (
  request_hash char(64) primary key check (request_hash ~ '^[a-f0-9]{64}$'),
  workspace_id text not null references litix_workspaces(id) on delete cascade,
  status text not null check (status in ('PROCESSING','SUCCESS','FAILED')),
  response_log jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists litix_idempotency_created_idx on litix_idempotency_records(created_at);
