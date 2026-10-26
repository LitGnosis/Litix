-- Additive only. Owner payment notices have a permanent once-per-order/recipient ledger.
-- Does not alter payments, supplier dispatch, subscription or catalog tables.
create table if not exists litix_owner_purchase_notices (
 order_id text not null,
 recipient text not null,
 event text not null default 'verified_payment',
 status text not null default 'claimed' check (status in ('claimed','sent','delivery_uncertain')),
 claimed_at timestamptz not null default now(),
 sent_at timestamptz,
 primary key (order_id, recipient, event)
);
create index if not exists litix_owner_purchase_notices_sent_idx
 on litix_owner_purchase_notices (status, claimed_at);
alter table litix_owner_purchase_notices enable row level security;
