// Reconcile Litix-owned $1 NMI sales without re-charging cards.
// Vercel Cron calls GET with Authorization: Bearer CRON_SECRET.
// Only a verified, fully settled NMI sale can create an owned fulfillment job.
import {neon} from "@neondatabase/serverless";
import {createHash,timingSafeEqual} from "node:crypto";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const GATEWAY="https://paykings.transactiongateway.com";
const response=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const hash=s=>createHash("sha256").update(s).digest("hex");
const tag=(xml,name)=>new RegExp("<"+name+">([^<]{0,300})</"+name+">","i").exec(xml)?.[1]?.trim()||"";

function authorized(request){
 const expected=String(process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET||"");
 const received=String(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(expected.length<24||!received)return false;
 return timingSafeEqual(Buffer.from(hash(expected),"hex"),Buffer.from(hash(received),"hex"));
}

async function checkSettlement(order,securityKey){
 // This is read-only. Never send a sale, capture, or refund request.
 if(!/^lpx_[a-f0-9]{32}$/.test(order.order_id)||
    !/^\d{5,32}$/.test(order.provider_transaction_id))return false;
 const reply=await fetch(GATEWAY+"/api/query.php",{
  method:"POST",cache:"no-store",redirect:"error",
  headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({
   security_key:securityKey,report_type:"transaction",
   transaction_id:order.provider_transaction_id
  }),
  signal:AbortSignal.timeout(11000)
 });
 if(!reply.ok)throw Error("nmi_query_http_error");
 const xml=await reply.text();
 if(xml.length>150000)throw Error("nmi_query_oversize");
 const transaction=/<transaction(?:\s[^>]*)?>([\s\S]*?)<\/transaction>/i.exec(xml)?.[1]||"";
 if(!transaction)return false;
 if(tag(transaction,"transaction_id")!==order.provider_transaction_id||
    tag(transaction,"order_id")!==order.order_id||
    tag(transaction,"condition")!=="complete"||
    (tag(transaction,"currency")&&tag(transaction,"currency")!=="USD"))return false;
 const actions=[...transaction.matchAll(/<action(?:\s[^>]*)?>([\s\S]*?)<\/action>/gi)].map(m=>m[1]);
 return actions.some(a=>tag(a,"action_type")==="sale"&&tag(a,"success")==="1"&&
  tag(a,"response_code")==="100"&&Math.round(Number(tag(a,"amount"))*100)===100)&&
  actions.some(a=>tag(a,"action_type")==="settle"&&tag(a,"success")==="1");
}

async function releaseExactlyOnce(sql,order){
 const payload=JSON.stringify({brief:order.payload.brief,isSyntheticTest:false});
 const stmt=`WITH verified_receipt AS (
   SELECT i.order_id,i.tenant_key,i.provider_transaction_id
   FROM growth_ops.litix_owned_payment_intents i
   JOIN growth_ops.litix_nmi_sale_receipts r
     ON r.order_id=i.order_id AND r.transaction_id=i.provider_transaction_id
    AND r.amount_cents=100 AND r.currency='USD'
   WHERE i.order_id=$1 AND i.state='awaiting_settlement'
     AND i.provider='nmi' AND i.service_kind='website_preview'
     AND i.live_mode=true AND i.execution_approved=false
     AND i.expected_amount_cents=100 AND i.currency='USD'
 ), recorded AS (
   INSERT INTO growth_ops.litix_nmi_settled_transactions(transaction_id,event_id)
   SELECT provider_transaction_id,'nmi-query-'||order_id FROM verified_receipt
   ON CONFLICT(transaction_id) DO NOTHING RETURNING transaction_id
 ), authorized AS (
   INSERT INTO public.master_fulfillment_grants(order_id,kind,verification_source,verified_at)
   SELECT v.order_id,'website_preview','nmi_query_settled',NOW()
   FROM verified_receipt v JOIN recorded s ON s.transaction_id=v.provider_transaction_id
   ON CONFLICT(order_id) DO NOTHING RETURNING order_id
 ), approved AS (
   UPDATE growth_ops.litix_owned_payment_intents i
   SET execution_approved=true,state='dispatch_pending',updated_at=NOW()
   WHERE i.order_id=$1 AND i.state='awaiting_settlement'
     AND EXISTS(SELECT 1 FROM authorized WHERE order_id=i.order_id)
   RETURNING i.order_id,i.tenant_key
 ), created_job AS (
   INSERT INTO public.master_node_jobs(order_id,tenant_key,kind,payload,payload_hash,status)
   SELECT order_id,tenant_key,'website_preview',$2::jsonb,$3,'queued' FROM approved
   ON CONFLICT(order_id) DO NOTHING RETURNING id,order_id
 ), queued AS (
   INSERT INTO growth_ops.litix_payment_dispatch_outbox(order_id,job_id)
   SELECT order_id,id FROM created_job
   ON CONFLICT(order_id) DO NOTHING RETURNING order_id
 ) SELECT (SELECT COUNT(*) FROM queued)::int AS n`;
 const rows=await sql.query(stmt,[order.order_id,payload,hash(payload)]);
 return rows[0]?.n===1;
}

export async function GET(request){
 if(!authorized(request))return response({error:"unauthorized"},401);
 if(process.env.VERCEL_ENV!=="production"||
    process.env.LITIX_DOLLAR_PILOT_ENABLED!=="true"||
    process.env.NMI_GATEWAY_MODE==="TEST")
  return response({ok:false,error:"production_pilot_disabled"},503);
 const dsn=process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||"";
 const key=String(process.env.NMI_SECURITY_KEY||"");
 if(!dsn||key.length<16)return response({ok:false,error:"payment_configuration_missing"},503);
 let sql,orders;
 try{
  sql=neon(dsn);
  orders=await sql.query(`SELECT i.order_id,i.provider_transaction_id,i.payload
   FROM growth_ops.litix_owned_payment_intents i
   JOIN growth_ops.litix_nmi_sale_receipts r
    ON r.order_id=i.order_id AND r.transaction_id=i.provider_transaction_id
   WHERE i.state='awaiting_settlement' AND i.provider='nmi'
     AND i.service_kind='website_preview' AND i.live_mode=true
     AND i.expected_amount_cents=100 AND i.currency='USD'
     AND r.amount_cents=100 AND r.currency='USD'
     AND i.created_at>NOW()-INTERVAL '14 days'
   ORDER BY i.created_at LIMIT 8`);
 }catch{
  return response({ok:false,error:"ledger_query_failed"},503);
 }
 let verified=0,queued=0,failed=0;
 // Three concurrent read-only queries per batch keep the function within 60s.
 for(let i=0;i<orders.length;i+=3){
  const results=await Promise.all(orders.slice(i,i+3).map(async order=>{
   try{
    if(!await checkSettlement(order,key))return {verified:0,queued:0,failed:0};
    const released=await releaseExactlyOnce(sql,order);
    return {verified:1,queued:released?1:0,failed:0};
   }catch{return {verified:0,queued:0,failed:1}}
  }));
  for(const r of results){verified+=r.verified;queued+=r.queued;failed+=r.failed}
 }
 if(failed)console.error("Litix settlement cron encountered query or ledger failures",{failed});
 return response({ok:failed===0,checked:orders.length,verified,queued,failed},failed?503:200);
}
