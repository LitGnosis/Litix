import {createHash,timingSafeEqual} from "node:crypto";
import {bundleDB,response,verifyNmiSettlement,sendBundleReceipt} from "../../../../lib/bundleOrders.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
function cronAuthorized(req){
 const secret=process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET,header=req.headers.get("authorization");
 if(!secret||!header?.startsWith("Bearer "))return false;
 const a=createHash("sha256").update(secret).digest(),b=createHash("sha256").update(header.slice(7)).digest();
 return timingSafeEqual(a,b);
}
export async function GET(req){
 if(!cronAuthorized(req))return response({error:"Unauthorized"},401);
 if(process.env.VERCEL_ENV!=="production")return response({ok:true,skipped:"not production"});
 const sql=bundleDB();let settled=0,refreshed=0;
 const waiting=await sql.query("select id,email,price_cents,package_name,gateway_transaction_id from litix_growth_bundle_orders where payment_state='approved_pending_settlement' and gateway_transaction_id is not null order by created_at limit 12");
 for(const o of waiting){
  const result=await verifyNmiSettlement({orderId:o.id,transactionId:o.gateway_transaction_id,priceCents:o.price_cents});
  if(!result.settled)continue;
  const updated=await sql.query("update litix_growth_bundle_orders set payment_state='settled',order_state='Awaiting WhatsApp Submission',settled_at=now(),updated_at=now() where id=$1 and payment_state='approved_pending_settlement' returning id,email,price_cents,package_name",[o.id]);
  if(updated.length){settled++;await sendBundleReceipt(updated[0]);}
 }
 // Only read statuses for orders which the owner previously explicitly released.
 if(process.env.SMMGLOB_API_KEY){
  const pending=await sql.query("select id,supplier_order_id from litix_growth_bundle_dispatch where status='submitted' and supplier_order_id is not null order by updated_at limit 15");
  for(const d of pending){
   try{
    const res=await fetch("https://smmglob.com/api/v2",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
     body:new URLSearchParams({key:process.env.SMMGLOB_API_KEY,action:"status",order:String(d.supplier_order_id)}),cache:"no-store",signal:AbortSignal.timeout(8000)});
    if(!res.ok)continue;
    const v=await res.json(),status=String(v?.status||"").toLowerCase();
    if(status==="completed"||status==="partial"||status==="canceled"){
     await sql.query("update litix_growth_bundle_dispatch set status=$2,updated_at=now() where id=$1 and status='submitted'",
      [d.id,status==="canceled"?"needs_attention":status]);
     refreshed++;
    }
   }catch{}
  }
  // An order is completed only when verified supplier-completed quantities cover every purchased package total.
  const orders=await sql.query("select id,package_items from litix_growth_bundle_orders where order_state in ('Processing','Partially Completed') and payment_state='settled' order by created_at limit 30");
  for(const o of orders){
   const sums=await sql.query("select d.kind,sum(d.quantity)::bigint as qty from litix_growth_bundle_dispatch d join litix_growth_bundle_posts p on p.id=d.post_id where p.order_id=$1 and d.status='completed' group by d.kind",[o.id]);
   const complete=Object.entries(o.package_items).every(([kind,n])=>sums.some(s=>s.kind===kind&&Number(s.qty)===Number(n)));
   const partial=sums.length>0;
   if(complete||partial)await sql.query("update litix_growth_bundle_orders set order_state=$2,updated_at=now() where id=$1 and order_state in ('Processing','Partially Completed')",[o.id,complete?"Completed":"Partially Completed"]);
  }
 }
 return response({ok:true,settledPayments: settled,statusesUpdated:refreshed});
}
