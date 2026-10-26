-- Authenticated NMI Query API is server-to-server verification of settled recurring transactions.
-- These are not cryptographically signed incoming webhooks. Record the method honestly.
alter table litix_autolikes_billing_events
 add column if not exists verification_method text not null default 'SIGNED_EVENT'
 check (verification_method in ('SIGNED_EVENT','AUTHENTICATED_QUERY'));
create index if not exists litix_billing_query_evidence_idx
 on litix_autolikes_billing_events(provider_subscription_item_id,verified_at desc)
 where verification_method='AUTHENTICATED_QUERY';
