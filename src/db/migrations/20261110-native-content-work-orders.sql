-- Litix-owned content-work-order ledger. Safe to apply without activating fulfillment.
-- No table or trigger here changes PayKings, Boostero, SMM orders, payment state, or historical incidents.
create table if not exists litix_native_work_orders (
  id uuid primary key,
  source_order_id text not null unique,
  spec_json jsonb not null,
  spec_hash char(64) not null check (spec_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'DRAFT' check (state in (
    'DRAFT', 'READY_FOR_OPERATOR', 'IN_PROGRESS', 'DELIVERED', 'REVIEW_REQUIRED', 'CANCELLED'
  )),
  operator_reference text,
  approval_reference text,
  evidence_url text,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists litix_native_work_orders_queue_idx
  on litix_native_work_orders(state, created_at)
  where state in ('READY_FOR_OPERATOR', 'IN_PROGRESS', 'REVIEW_REQUIRED');

create table if not exists litix_native_work_events (
  event_id bigint generated always as identity primary key,
  work_order_id uuid not null references litix_native_work_orders(id) on delete restrict,
  old_state text,
  new_state text not null,
  recorded_at timestamptz not null default now()
);
create index if not exists litix_native_work_events_order_idx
  on litix_native_work_events(work_order_id, recorded_at desc);

create or replace function litix_native_work_audit() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.state <> 'DRAFT' then
      raise exception 'Native work must start as draft';
    end if;
    insert into litix_native_work_events(work_order_id,old_state,new_state)
      values(new.id,null,new.state);
    return new;
  end if;
  if new.source_order_id is distinct from old.source_order_id
    or new.spec_hash is distinct from old.spec_hash
    or new.spec_json is distinct from old.spec_json then
    raise exception 'Native work source/spec cannot change';
  end if;
  if new.state is distinct from old.state then
    if not (
      (old.state = 'DRAFT' and new.state in ('READY_FOR_OPERATOR','CANCELLED')) or
      (old.state = 'READY_FOR_OPERATOR' and new.state in ('IN_PROGRESS','REVIEW_REQUIRED','CANCELLED')) or
      (old.state = 'IN_PROGRESS' and new.state in ('DELIVERED','REVIEW_REQUIRED')) or
      (old.state = 'REVIEW_REQUIRED' and new.state in ('IN_PROGRESS','CANCELLED'))
    ) then
      raise exception 'Invalid native work state change';
    end if;
    if new.state = 'READY_FOR_OPERATOR' and (
      nullif(new.operator_reference,'') is null or nullif(new.approval_reference,'') is null
    ) then
      raise exception 'Operator and written approval required';
    end if;
    if new.state = 'DELIVERED' and nullif(new.evidence_url,'') is null then
      raise exception 'Evidence required before delivery';
    end if;
    insert into litix_native_work_events(work_order_id,old_state,new_state)
      values(new.id,old.state,new.state);
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists litix_native_work_insert_audit on litix_native_work_orders;
create trigger litix_native_work_insert_audit
  after insert on litix_native_work_orders
  for each row execute function litix_native_work_audit();

drop trigger if exists litix_native_work_update_audit on litix_native_work_orders;
create trigger litix_native_work_update_audit
  before update on litix_native_work_orders
  for each row execute function litix_native_work_audit();

-- Application DB role should have only the minimum required grants from platform setup.
-- Never expose this schema through anonymous/public database read or write access.
