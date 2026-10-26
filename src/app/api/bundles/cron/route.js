import {createHash,timingSafeEqual} from "node:crypto";
import {bundleDB,response,verifyNmiSettlement,sendBundleReceipt} from "../../../../lib/bundleOrders.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
function authorized(req){
 const key=process.env.CRON_SECRET||process.env.LITIX_CRON_SECRET;
 const bearer=(req.headers.get("authorization")||"").replace(/^Bearer\s+/,"");
 if(!key||!bearer)return false;
 return timingSafeEqual(createHash("sha256").update(key).digest(),createHash("sha256").update(bearer).digest());
}
export async function GET(req){
 if(!authorized(req))return response({error:"Unauthorized"},401);
 if(process.env.VERCEL_ENV!=="production")return response({ok:true,skipped:"not production"});
 if(process.env.LITIX_BUNDLES_LIVE_ENABLED!=="true")return response({ok:true,skipped:"bundles disabled"});
 const sql=bundleDB(),waiting=await sql.query(
  "select id,email,price_cents,package_name,gateway_transaction_id from litix_growth_bundle_orders where payment_state='approved_pending_settlement' and gateway_transaction_id is not null order by created_at limit 12");
 let settled=0;
 for(const order of waiting){
  const result=await verifyNmiSettlement({orderId:order.id,transactionId:order.gateway_transaction_id,priceCents:order.price_cents});
  if(!result.settled)continue;
  const updated=await sql.query("update litix_growth_bundle_orders set payment_state='settled',settled_at=now(),updated_at=now() where id=$1 and payment_state='approved_pending_settlement' returning id,email,price_cents,package_name",[order.id]);
  if(updated.length){settled++;await sendBundleReceipt(updated[0],sql).catch(()=>false);}
 }
 // Absolutely no automated SMMGLOB dispatch or supplier status calls for manual bundles.
 return response({ok:true,settledPayments:settled,manualFulfillmentOnly:true});
}
