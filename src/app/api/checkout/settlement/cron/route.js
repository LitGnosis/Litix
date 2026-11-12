// Reconcile Litix-owned $1 NMI sales without re-charging cards.
// Vercel Cron calls GET with Authorization: Bearer CRON_SECRET.
// Only a verified, fully settled NMI sale can create an owned fulfillment job.
import {neon} from "@neondatabase/serverless";
import {createHash,timingSafeEqual} from "node:crypto";
import {verifyNmiCapturedSale} from "../../../../../lib/litixVerifiedSale.mjs";
import {queueCapturedOwnedJob,recordOwnedSettlement} from "../../../../../lib/litixCapturedFulfillment.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const response=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const hash=s=>createHash("sha256").update(s).digest("hex");

function authorized(request){
 const expected=String(process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET||"");
 const received=String(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(expected.length<24||!received)return false;
 return timingSafeEqual(Buffer.from(hash(expected),"hex"),Buffer.from(hash(received),"hex"));
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
 let verified=0,queued=0,settled=0,failed=0;
 // Three concurrent read-only queries per batch keep the function within 60s.
 for(let i=0;i<orders.length;i+=3){
  const results=await Promise.all(orders.slice(i,i+3).map(async order=>{
   try{
    const evidence=await verifyNmiCapturedSale({orderId:order.order_id,
     transactionId:order.provider_transaction_id,securityKey:key,amountCents:100});
    if(!evidence.captured)return {verified:0,queued:0,settled:0,failed:0};
    const released=await queueCapturedOwnedJob(sql,order);
    const settled=evidence.settled?await recordOwnedSettlement(sql,order):false;
    return {verified:1,queued:released?1:0,settled:settled?1:0,failed:0};
   }catch{return {verified:0,queued:0,settled:0,failed:1}}
  }));
  for(const r of results){verified+=r.verified;queued+=r.queued;settled+=r.settled;failed+=r.failed}
 }
 if(failed)console.error("Litix settlement cron encountered query or ledger failures",{failed});
 return response({ok:failed===0,checked:orders.length,verifiedCaptured:verified,queued,settled,failed},failed?503:200);
}
