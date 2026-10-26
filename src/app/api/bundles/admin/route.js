import {randomUUID} from "node:crypto";
import {bundleDB,response,sameOrigin,safeEquals,verifyNmiSettlement,sendBundleReceipt} from "../../../../lib/bundleOrders.mjs";
import {growthBundle,validPost,allocationsValid,BUNDLE_KINDS} from "../../../../lib/growthBundles.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=50;
const authorized=req=>{
 const configured=process.env.LITIX_BUNDLES_ADMIN_TOKEN;
 const provided=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 return Boolean(configured&&configured.length>=32&&provided.length>=32&&provided.length<=256&&safeEquals(configured,provided));
};
const audit=async(sql,orderId,action,details)=>sql.query(
 "insert into litix_growth_bundle_audit(id,order_id,admin_action,details) values($1,$2,$3,$4::jsonb)",
 ["ba_"+randomUUID(),orderId,action,JSON.stringify(details||{})]);
export async function GET(req){
 if(!authorized(req))return response({error:"Admin authorization required"},401);
 try{
  const sql=bundleDB();
  const orders=await sql.query("select id,package_id,package_name,platform,price_cents,email,payment_state,order_state,gateway_transaction_id,package_items,created_at from litix_growth_bundle_orders order by created_at desc limit 75");
  const posts=await sql.query("select id,order_id,post_url,status,allocations from litix_growth_bundle_posts where order_id=any($1::text[]) order by created_at",[orders.map(o=>o.id)]);
  const dispatch=await sql.query("select d.id,d.post_id,d.kind,d.quantity,d.status,d.supplier_order_id from litix_growth_bundle_dispatch d join litix_growth_bundle_posts p on p.id=d.post_id where p.order_id=any($1::text[]) order by d.attempted_at desc",[orders.map(o=>o.id)]);
  const history=await sql.query("select order_id,admin_action,details,created_at from litix_growth_bundle_audit where order_id=any($1::text[]) order by created_at desc limit 150",[orders.map(o=>o.id)]);
  return response({orders,posts,dispatch,history});
 }catch{return response({error:"Bundle dashboard database unavailable"},503);}
}
export async function POST(req){
 if(!authorized(req))return response({error:"Admin authorization required"},401);
 if(!sameOrigin(req))return response({error:"Invalid origin"},403);
 let data;try{const raw=await req.text();if(raw.length>16000)throw Error();data=JSON.parse(raw)}catch{return response({error:"Invalid request"},400)}
 const orderId=String(data?.orderId||""),action=String(data?.action||"");
 if(!/^lbg_[0-9a-f-]{36}$/.test(orderId))return response({error:"Invalid order reference"},422);
 const sql=bundleDB();
 try{
  const rows=await sql.query("select * from litix_growth_bundle_orders where id=$1",[orderId]);
  if(!rows.length)return response({error:"Order not found"},404);
  const order=rows[0],bundle=growthBundle(order.package_id);
  if(!bundle)return response({error:"Unknown catalog package"},422);
  if(action==="refreshSettlement"){
   if(!order.gateway_transaction_id||!["approved_pending_settlement","settled"].includes(order.payment_state))
    return response({error:"No approved gateway transaction to reconcile"},409);
   const checked=await verifyNmiSettlement({orderId,transactionId:order.gateway_transaction_id,priceCents:order.price_cents});
   if(!checked.settled)return response({ok:false,settled:false,reason:checked.reason},202);
   const updated=await sql.query("update litix_growth_bundle_orders set payment_state='settled',settled_at=coalesce(settled_at,now()),order_state=case when order_state='Awaiting Payment' then 'Awaiting WhatsApp Submission' else order_state end,updated_at=now() where id=$1 and payment_state in ('approved_pending_settlement','settled') returning id,email,package_name,price_cents",[orderId]);
   if(updated.length){await sendBundleReceipt(updated[0]);await audit(sql,orderId,"PAYMENT_SETTLEMENT_VERIFIED",{gatewayTransactionId:order.gateway_transaction_id});}
   return response({ok:true,settled:true});
  }
  if(order.payment_state!=="settled")return response({error:"Payment settlement must be independently verified before post allocation or fulfillment"},409);
  if(action==="savePost"){
   const raw=String(data.url||"").trim(),allocations=data.allocations||{};
   if(!validPost(raw,bundle.platform))return response({error:"Invalid platform post URL"},422);
   const uri=new URL(raw);uri.search="";uri.hash="";
   const url=uri.origin.replace("://www.","://")+uri.pathname.replace(/\/$/,"");
   if(!allocationsValid(bundle,[{url,...allocations}]))
    return response({error:"Public post URL or service quantities invalid"},422);
   const saved=await sql.query("select litix_bundle_save_post($1,$2,$3,$4::jsonb) as post_id",
     [orderId,"bp_"+randomUUID(),url,JSON.stringify(allocations)]);
   await audit(sql,orderId,"SAVE_POST_ALLOCATION",{postId:saved[0].post_id,url,allocations});
   return response({ok:true,postId:saved[0].post_id});
  }
  const postId=String(data.postId||"");
  const posts=await sql.query("select * from litix_growth_bundle_posts where id=$1 and order_id=$2",[postId,orderId]);
  if(!posts.length)return response({error:"Post not found"},404);
  const post=posts[0];
  if(action==="rejectPost"){
   const changed=await sql.query("update litix_growth_bundle_posts set status='Rejected' where id=$1 and status='Under Review' returning id",[postId]);
   if(!changed.length)return response({error:"Cannot reject an approved or processing post"},409);
   await audit(sql,orderId,"POST_REJECTED",{postId});
   return response({ok:true});
  }
  if(action==="approvePost"){
   if(post.status!=="Under Review"||!allocationsValid(bundle,[{url:post.post_url,...post.allocations}]))
    return response({error:"Invalid post allocation"},409);
   const kinds=BUNDLE_KINDS.filter(k=>Number(post.allocations?.[k]||0)>0);
   if(!kinds.length)return response({error:"Assign at least one service"},422);
   const mapped=await sql.query("select kind,service_id,min_qty,max_qty from litix_growth_bundle_supplier_mappings where platform=$1 and kind=any($2::text[]) and verified_at is not null",[bundle.platform,kinds]);
   for(const kind of kinds){
    const m=mapped.find(x=>x.kind===kind),q=Number(post.allocations[kind]);
    if(!m||!m.service_id||q<Number(m.min_qty)||q>Number(m.max_qty))
     return response({error:"Verified supplier route unavailable or quantity outside limits for "+kind},409);
   }
   const updated=await sql.query("update litix_growth_bundle_posts set status='Approved',approved_at=now() where id=$1 and status='Under Review' returning id",[postId]);
   if(!updated.length)return response({error:"Post changed while reviewing"},409);
   await sql.query("update litix_growth_bundle_orders set order_state='Approved',approved_at=now(),updated_at=now() where id=$1 and order_state in ('Under Review','Approved')",[orderId]);
   await audit(sql,orderId,"POST_APPROVED",{postId,kinds});
   return response({ok:true,approved:true});
  }
  if(action==="release"){
   if(post.status!=="Approved")return response({error:"Explicit post approval required"},409);
   if(process.env.VERCEL_ENV!=="production"||process.env.LITIX_BUNDLES_LIVE_ENABLED!=="true"||!process.env.SMMGLOB_API_KEY)
    return response({error:"Verified production SMMGLOB dispatch is disabled"},503);
   const kind=String(data.kind||""),quantity=Number(post.allocations?.[kind]);
   if(!BUNDLE_KINDS.includes(kind)||!Number.isSafeInteger(quantity)||quantity<=0)return response({error:"Invalid service allocation"},422);
   const maps=await sql.query("select service_id,min_qty,max_qty from litix_growth_bundle_supplier_mappings where platform=$1 and kind=$2 and verified_at is not null",[bundle.platform,kind]);
   const m=maps[0];if(!m||!/^\d+$/.test(String(m.service_id))||quantity<Number(m.min_qty)||quantity>Number(m.max_qty))return response({error:"Unverified supplier service or unsupported order quantity"},409);
   // Reserve exact line ONCE before calling the supplier. Unknown outcomes never retry automatically.
   const rid="bd_"+randomUUID();
   const reserved=await sql.query(
    "insert into litix_growth_bundle_dispatch(id,post_id,kind,quantity) select $1,p.id,$2,$3 from litix_growth_bundle_posts p join litix_growth_bundle_orders o on o.id=p.order_id where p.id=$4 and p.order_id=$5 and p.status='Approved' and o.payment_state='settled' on conflict(post_id,kind) do nothing returning id",
    [rid,kind,quantity,postId,orderId]);
   if(!reserved.length)return response({error:"This service allocation was already sent or reserved; investigate before retrying"},409);
   await sql.query("update litix_growth_bundle_orders set order_state='Processing',updated_at=now() where id=$1",[orderId]);
   await audit(sql,orderId,"OWNER_APPROVED_SUPPLIER_RELEASE",{postId,kind,quantity,reservationId:rid});
   let outcome={status:"unknown"};try{
    const r=await fetch("https://smmglob.com/api/v2",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
     body:new URLSearchParams({key:process.env.SMMGLOB_API_KEY,action:"add",service:String(m.service_id),link:post.post_url,quantity:String(quantity)}),
     signal:AbortSignal.timeout(16000),cache:"no-store"});
    if(r.ok){const result=await r.json();if(/^\d+$/.test(String(result?.order||"")))outcome={status:"submitted",supplier:String(result.order)};
     else if(result?.error)outcome={status:"declined"};}
   }catch{}
   await sql.query("update litix_growth_bundle_dispatch set status=$2,supplier_order_id=$3,updated_at=now() where id=$1",[rid,outcome.status,outcome.supplier||null]);
   if(outcome.status!=="submitted")await sql.query("update litix_growth_bundle_orders set order_state='Needs Attention' where id=$1",[orderId]);
   return response({ok:outcome.status==="submitted",status:outcome.status,dispatchId:rid},outcome.status==="submitted"?200:202);
  }
  return response({error:"Unsupported admin operation"},400);
 }catch(e){return response({error:"Bundle admin operation needs review. No automatic retries.",code:String(e?.code||"REVIEW").slice(0,32)},503);}
}
