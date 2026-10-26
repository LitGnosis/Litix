import {randomUUID} from "node:crypto";
import {bundleDB,response,sameOrigin,safeEquals,verifyNmiSettlement,sendBundleReceipt} from "../../../../lib/bundleOrders.mjs";
import {growthBundle,validPost,allocationsValid,POST_BUNDLE_KINDS} from "../../../../lib/growthBundles.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=50;
const authorized=req=>{
 const configured=process.env.LITIX_BUNDLES_ADMIN_TOKEN||process.env.ADMIN_SECRET;
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
  const orders=await sql.query("select id,package_id,package_name,platform,price_cents,email,payment_state,order_state,gateway_transaction_id,package_items,followers_fulfilled,profile_ref,created_at from litix_growth_bundle_orders order by created_at desc limit 75");
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
   if(updated.length){await sendBundleReceipt(updated[0],sql);await audit(sql,orderId,"PAYMENT_SETTLEMENT_VERIFIED",{gatewayTransactionId:order.gateway_transaction_id});}
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
  if(action==="markFollowersFulfilled"){
   // Followers are delivered manually to the purchased account, never to a post URL.
   if(data.manuallyVerified!==true || !order.profile_ref)
    return response({error:"Verify actual account-level Followers delivery before recording it"},422);
   const qty=Number(order.package_items?.Followers);
   if(!Number.isSafeInteger(qty)||qty<=0)return response({error:"This purchase has no Followers entitlement"},409);
   const updated=await sql.query(
    "update litix_growth_bundle_orders set followers_fulfilled=$2,updated_at=now() where id=$1 and payment_state='settled' and followers_fulfilled=0 returning id",
    [orderId,qty]);
   if(!updated.length)return response({error:"Followers already recorded or order is no longer eligible"},409);
   const posts=await sql.query(
    "select status,allocations from litix_growth_bundle_posts where order_id=$1 and status<>'Rejected'",[orderId]);
   const finished=posts.length>0 && posts.every(p=>p.status==="Completed") &&
    POST_BUNDLE_KINDS.every(k=>posts.reduce((sum,p)=>sum+Number(p.allocations?.[k]||0),0)===Number(order.package_items?.[k]||0));
   if(finished)await sql.query("update litix_growth_bundle_orders set order_state='Completed',updated_at=now() where id=$1",[orderId]);
   await audit(sql,orderId,"OWNER_VERIFIED_ACCOUNT_FOLLOWERS",{platform:order.platform,quantity:qty,allDeliveriesComplete:finished});
   return response({ok:true,followersFulfilled:qty,status:finished?"Completed":order.order_state});
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
   const kinds=POST_BUNDLE_KINDS.filter(k=>Number(post.allocations?.[k]||0)>0);
   if(!kinds.length)return response({error:"Assign at least one service"},422);
   // Manual order: post review never depends on supplier API mapping.
   const updated=await sql.query("update litix_growth_bundle_posts set status='Approved',approved_at=now() where id=$1 and status='Under Review' returning id",[postId]);
   if(!updated.length)return response({error:"Post changed while reviewing"},409);
   await sql.query("update litix_growth_bundle_orders set order_state='Approved',approved_at=now(),updated_at=now() where id=$1 and order_state in ('Under Review','Approved')",[orderId]);
   await audit(sql,orderId,"POST_APPROVED",{postId,kinds});
   return response({ok:true,approved:true});
  }
  // Bundle fulfillment is performed personally, outside this website.
  if(action==="markManualProcessing"){
   const changed=await sql.query("update litix_growth_bundle_posts set status='Processing' where id=$1 and status='Approved' returning id",[postId]);
   if(!changed.length)return response({error:"Approve this post before marking processing"},409);
   await sql.query("update litix_growth_bundle_orders set order_state='Processing',updated_at=now() where id=$1",[orderId]);
   await audit(sql,orderId,"OWNER_MARKED_MANUAL_PROCESSING",{postId});
   return response({ok:true,status:"Processing"});
  }
  if(action==="markManualCompleted"){
   if(data.manuallyVerified!==true)return response({error:"Owner must explicitly confirm manual delivery"},422);
   const changed=await sql.query("update litix_growth_bundle_posts set status='Completed' where id=$1 and status in ('Approved','Processing') returning id",[postId]);
   if(!changed.length)return response({error:"Post must first be approved and not already completed"},409);
   const counted=await sql.query("select status,allocations from litix_growth_bundle_posts where order_id=$1 and status<>'Rejected'",[orderId]);
   const complete=counted.length>0 && counted.every(p=>p.status==="Completed") &&
     POST_BUNDLE_KINDS.every(kind=>counted.reduce((n,p)=>n+Number(p.allocations?.[kind]||0),0)===Number(order.package_items?.[kind]||0)) &&
     Number(order.followers_fulfilled)===Number(order.package_items?.Followers||0);
   await sql.query("update litix_growth_bundle_orders set order_state=$2,updated_at=now() where id=$1",[orderId,complete?"Completed":"Partially Completed"]);
   await audit(sql,orderId,"OWNER_CONFIRMED_MANUAL_DELIVERY",{postId,allPackageTotalsDelivered:complete});
   return response({ok:true,status:complete?"Completed":"Partially Completed"});
  }
  if(action==="release")return response({error:"Automated supplier dispatch is disabled. Fulfill personally and record delivery."},410);
  return response({error:"Unsupported admin operation"},400);
 }catch(e){return response({error:"Bundle admin operation needs review. No automatic retries.",code:String(e?.code||"REVIEW").slice(0,32)},503);}
}
