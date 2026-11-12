// Idempotent first-party dispatch. Caller MUST independently verify a captured
// NMI sale (never an auth-only hold) before invoking these functions.
import {createHash} from "node:crypto";
const sha=s=>createHash("sha256").update(s).digest("hex");
export async function queueCapturedOwnedJob(sql,order){
 if(!/^lpx_[0-9a-f]{32}$/.test(order?.order_id||"")||
    !/^[0-9]{5,32}$/.test(order?.provider_transaction_id||"")||
    !order?.payload?.brief)return false;
 const body=JSON.stringify({brief:order.payload.brief,isSyntheticTest:false});
 const statement=String.raw`WITH qualified AS (
  SELECT i.order_id,i.tenant_key
  FROM growth_ops.litix_owned_payment_intents i
  JOIN growth_ops.litix_nmi_sale_receipts r
    ON r.order_id=i.order_id AND r.transaction_id=i.provider_transaction_id
   AND r.amount_cents=100 AND r.currency='USD'
  WHERE i.order_id=$1 AND i.provider_transaction_id=$2
    AND i.provider='nmi' AND i.live_mode=true
    AND i.expected_amount_cents=100 AND i.currency='USD'
    AND i.service_kind='website_preview' AND i.state='awaiting_settlement'
    AND EXISTS(SELECT 1 FROM public.master_execution_nodes n
      WHERE n.id='litix-direct-primary-01' AND n.owned=true AND n.enabled=true
        AND n.last_seen>NOW()-INTERVAL '90 seconds')
 ), grant_once AS (
  INSERT INTO public.master_fulfillment_grants(order_id,kind,verification_source,verified_at)
  SELECT order_id,'website_preview','nmi_query_captured_sale',NOW() FROM qualified
  ON CONFLICT(order_id) DO NOTHING RETURNING order_id
 ), approved AS (
  UPDATE growth_ops.litix_owned_payment_intents i
  SET execution_approved=true,updated_at=NOW()
  WHERE i.order_id IN (SELECT order_id FROM qualified)
    AND EXISTS(SELECT 1 FROM public.master_fulfillment_grants g
     WHERE g.order_id=i.order_id AND g.kind='website_preview'
       AND g.verification_source IN('nmi_query_captured_sale','nmi_query_settled')
       AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>NOW()))
  RETURNING i.order_id,i.tenant_key
 ), created AS (
  INSERT INTO public.master_node_jobs(order_id,tenant_key,kind,payload,payload_hash,status)
  SELECT order_id,tenant_key,'website_preview',$3::jsonb,$4,'queued' FROM approved
  ON CONFLICT(order_id) DO NOTHING RETURNING id,order_id
 ), sent AS (
  INSERT INTO growth_ops.litix_payment_dispatch_outbox(order_id,job_id)
  SELECT j.order_id,j.id FROM public.master_node_jobs j
  JOIN approved a ON a.order_id=j.order_id
  WHERE j.status='queued' AND j.kind='website_preview'
  ON CONFLICT(order_id) DO NOTHING RETURNING order_id
 ) SELECT (SELECT COUNT(*) FROM sent)::int AS queued`;
 const row=(await sql.query(statement,[
  order.order_id,order.provider_transaction_id,body,sha(body)]))[0]||{};
 return row.queued===1;
}
export async function recordOwnedSettlement(sql,order){
 if(!/^lpx_[0-9a-f]{32}$/.test(order?.order_id||"")||
    !/^[0-9]{5,32}$/.test(order?.provider_transaction_id||""))return false;
 const statement=String.raw`WITH matched AS (
  SELECT i.order_id,i.provider_transaction_id
  FROM growth_ops.litix_owned_payment_intents i
  JOIN growth_ops.litix_nmi_sale_receipts r
    ON r.order_id=i.order_id AND r.transaction_id=i.provider_transaction_id
   AND r.amount_cents=100 AND r.currency='USD'
  WHERE i.order_id=$1 AND i.provider_transaction_id=$2
    AND i.provider='nmi' AND i.live_mode=true AND i.expected_amount_cents=100
    AND i.currency='USD' AND i.service_kind='website_preview'
    AND i.state IN('awaiting_settlement','dispatch_pending')
 ), recorded AS (
  INSERT INTO growth_ops.litix_nmi_settled_transactions(transaction_id,event_id)
  SELECT provider_transaction_id,'nmi-query-'||order_id FROM matched
  ON CONFLICT(transaction_id) DO NOTHING RETURNING transaction_id
 ), finalized AS (
  UPDATE growth_ops.litix_owned_payment_intents i
  SET state='dispatch_pending',updated_at=NOW()
  WHERE i.order_id=$1 AND i.provider_transaction_id=$2
    AND i.state='awaiting_settlement'
    AND EXISTS(SELECT 1 FROM growth_ops.litix_nmi_settled_transactions s
      WHERE s.transaction_id=i.provider_transaction_id)
  RETURNING order_id
 ) SELECT EXISTS(SELECT 1 FROM growth_ops.litix_nmi_settled_transactions
      WHERE transaction_id=$2) AS verified`;
 const x=(await sql.query(statement,[order.order_id,order.provider_transaction_id]))[0]||{};
 return x.verified===true;
}
