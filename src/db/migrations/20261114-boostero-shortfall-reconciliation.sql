-- Read-only financial reconciliation for supplier shortfalls.
-- Never authorize a new supplier order or issue a payment refund from a status alone.
CREATE OR REPLACE VIEW public.litix_boostero_shortfall_reviews AS
SELECT
  o.id AS litix_order_id,
  o.payment_transaction_id AS paykings_transaction_id,
  o.amount_cents,
  o.quantity AS ordered_quantity,
  f.supplier_order_id,
  f.state AS fulfillment_state,
  f.supplier_status->>'status' AS supplier_reported_status,
  CASE
    WHEN (f.supplier_status->>'remains') ~ '^[0-9]{1,10}$'
     AND (f.supplier_status->>'remains')::bigint BETWEEN 0 AND o.quantity
     THEN (f.supplier_status->>'remains')::bigint
    ELSE NULL
  END AS verified_remains,
  CASE
    WHEN (f.supplier_status->>'remains') ~ '^[0-9]{1,10}$'
     AND (f.supplier_status->>'remains')::bigint BETWEEN 0 AND o.quantity
     THEN round(o.amount_cents::numeric *
       (f.supplier_status->>'remains')::numeric / nullif(o.quantity,0))::bigint
    ELSE NULL
  END AS proposed_prorated_credit_cents,
  'MANUAL_RECONCILIATION_REQUIRED'::text AS resolution_state,
  f.updated_at
FROM public.litix_v2_orders o
JOIN public.litix_boostero_fulfillment f ON f.litix_order_id=o.id
WHERE o.payment_state='paid'
 AND f.state IN ('FAILED','MANUAL_REVIEW','UNKNOWN_OUTCOME','REJECTED');
