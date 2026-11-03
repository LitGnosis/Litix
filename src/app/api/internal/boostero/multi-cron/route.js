import {createHash,timingSafeEqual} from "node:crypto";
import {boosteroSQL,boosteroProductionReady} from "../../../../../lib/boosteroFulfillment.mjs";
import {dispatchBoosteroPost,syncBoosteroMultiStatuses} from "../../../../../lib/boosteroMultiPostFulfillment.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

function authorized(req){
 const expected=String(process.env.CRON_SECRET||"");
 const supplied=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(expected.length<24||!supplied)return false;
 const h=v=>createHash("sha256").update(v).digest();
 return timingSafeEqual(h(expected),h(supplied));
}
async function resumeSinglePaidPost(sql){
 const rows=await sql.query(
  "select p.parent_order_id,p.ordinal from public.litix_boostero_multi_posts p join public.litix_v2_orders o on o.id=p.parent_order_id where p.state='QUEUED' and p.attempt_id is null and p.supplier_order_id is null and o.payment_state='paid' and o.payment_transaction_id is not null and o.metadata->>'supplier'='boostero' order by p.created_at asc limit 1"
 );
 if(!rows.length)return {checked:0,submitted:0};
 const item=rows[0];
 // This function atomically claims the existing paid child and never retries
 // an ambiguous supplier add. One child per run keeps invocation bounded.
 const outcome=await dispatchBoosteroPost(item.parent_order_id,Number(item.ordinal),{sql});
 return {checked:1,submitted:outcome.submitted?1:0,requiresReview:outcome.requiresReview===true};
}
export async function GET(req){
 if(!authorized(req))return Response.json({error:"Unauthorized"},{status:401,headers:{"cache-control":"no-store"}});
 if(process.env.VERCEL_ENV!=="production")return Response.json({ok:true,skipped:"preview_not_scheduled"});
 if(!boosteroProductionReady()||process.env.LITIX_MULTIPOST_AUTO_FULFILL_ENABLED!=="true")
  return Response.json({ok:true,skipped:"multi_post_disabled"});
 try{
  const sql=boosteroSQL();
  const result=await Promise.allSettled([
   syncBoosteroMultiStatuses({sql,limit:6}),
   resumeSinglePaidPost(sql)
  ]);
  const ok=result.every(x=>x.status==="fulfilled");
  return Response.json({ok,
   statuses:result[0].status==="fulfilled"?result[0].value:{failed:1},
   continuation:result[1].status==="fulfilled"?result[1].value:{failed:1}},
   {status:ok?200:503,headers:{"cache-control":"no-store"}});
 }catch{
  return Response.json({ok:false,error:"Multi-post background polling unavailable"},
   {status:503,headers:{"cache-control":"no-store"}});
 }
}
