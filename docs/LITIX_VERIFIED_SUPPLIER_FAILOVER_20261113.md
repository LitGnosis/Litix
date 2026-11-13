# Litix verified catalog / supplier failover release runbook
November 13, 2026 — migration 20261113-litix-durable-catalog-verified-supplier-failover.sql

## What is live-safe
- /api/catalog/v1 reads supplier catalog as before, stores only public, sanitized,
  previously verified catalog cards in Litix's Neon database.
- After a cold start or temporary provider outage, that database snapshot can
  serve up to 24-hour-old product **browsing** results, tagged cached.
- A cached or unavailable supplier feed can NEVER enable PayKings card fields.
  The checkout boundary still requires a live price/availability verification.
- Do not expose upstream API names, wholesale pricing or secret API keys to buyers.
- No existing paid or historical Boostero orders are modified or resubmitted.
- Original first-party services and workers remain unchanged.

## New supplier mappings are intentionally gated
- Table public.litix_verified_supplier_routes records exactly two possible
  approved routes per Litix SKU: priority 1 (primary) and priority 2 (fallback).
- Provider codes: SMMWIZ, JAP and PEAKERR. This is *not* an assertion that
  these providers are currently configured, approved or fulfill a given SKU.
- A provider service ID is NOT interchangeable with a Boostero service ID.
  Never guess or auto-copy an upstream SKU number. Match platform, kind,
  geography, quantity range, service type, actual wholesale cost and payout
  compatibility against the supplier's current authenticated services list.
- Each row must include verified_at, verified_source, owner_approved=true,
  enabled=true. The router additionally requires a verification no older than
  14 days and a fresh supplier catalog lookup immediately before placing an order.
- Use server-only secrets:
    LITIX_SMMWIZ_API_KEY
    LITIX_JAP_API_KEY
    LITIX_PEAKERR_API_KEY
  Optional authenticated endpoint overrides if documentation demands a different
  route on the same allowed host:
    LITIX_SMMWIZ_API_URL
    LITIX_JAP_API_URL
    LITIX_PEAKERR_API_URL
  The outbound allowlist checks HTTPS, exact host, path, and rejects ports, query
  strings and embedded credentials. Verify each company's actual API URL before
  activation. Do not publish keys in GitHub, screenshots or chat.
- *New orders only*: a separate approved checkout writer must first record
  a settled PayKings sale with:
    payment_state='paid', payment_transaction_id IS NOT NULL,
    fulfillment_state='queued', metadata.supplier='verified_router'
  and no Boostero fulfillment record. The current Boostero checkout does NOT
  create such orders; do not flip the new router flag until that transaction
  integration and full end-to-end audit are complete.
- Then the internal-only POST /api/internal/verified-supplier-dispatch is able to
  dispatch one paid, verified-router order. Requires LITIX_INTERNAL_SERVICE_TOKEN,
  and LITIX_VERIFIED_SUPPLIER_FAILOVER_ENABLED=true in production.
  **The flag is disabled by default.**
- Durable claim in public.litix_supplier_route_claims prevents retries once an
  order dispatch has started. Unknown provider/HTTP/network outcomes go to
  MANUAL_REVIEW (never to fallback); failover is allowed only on an explicit
  upstream service-disabled/not-found rejection, or before a supplier add
  was attempted when a read-only quote fails.
- A single supplier acceptance is recorded and a second supplier is never
  charged for an uncertain or already accepted transaction.

## Operational verification before activation
1. Run the additive migration in the correct Litix neondb production database;
   do not run it against the isolated LitGnosis platform database.
2. Run Node tests, Next production build, and verify new public checkout behavior
   in Vercel preview, without submitting real cards.
3. Verify each provider account, live API key, funded wallet, supported link
   formats, taxes, platform restrictions, cost ceiling, and owner-approved
   service mappings. Unverified mappings stay absent/disabled.
4. Create a new payment-authorized checkout path for verified_router orders,
   including idempotency, payment settlement proof, customer receipts, and
   reconciliation. Retain the old Boostero route until migration tests pass.
5. Test (in approved supplier testing mode): primary rejects SKU explicitly,
   fallback accepts, only one supplier order; transport timeout after add
   causes MANUAL_REVIEW and **no second add**. Test subscription/multi-post
   separately; generic single-order code must not split those orders.
6. Verify success and partial/refund reconciliation, status polling from the
   correct winning supplier, owner alerts, and a rollback toggle.
7. Only then set LITIX_VERIFIED_SUPPLIER_FAILOVER_ENABLED=true and enable
   each verified mapping. Do not bulk-enable all services by name.

### Useful read-only SQL
SELECT count(*) AS cached_cards,
       max(observed_at) AS newest_snapshot
FROM public.litix_public_catalog_snapshot;

SELECT count(DISTINCT litix_service_id) AS fully_mapped_services
FROM (
 SELECT litix_service_id
 FROM public.litix_verified_supplier_routes
 WHERE enabled AND owner_approved AND verified_at>now()-interval '14 days'
 GROUP BY litix_service_id
 HAVING bool_or(priority=1) AND bool_or(priority=2)
) AS covered;

SELECT final_state,count(*) FROM public.litix_supplier_route_claims
GROUP BY final_state ORDER BY final_state;

### Safety note
A supplier timeout is NOT a confirmed declined order. Never automatically
resubmit a paid order across providers until an authoritative settlement/accept
status proves the first provider never created an order.
