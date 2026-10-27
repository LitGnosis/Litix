import {neon} from "@neondatabase/serverless";
import {createHash,randomUUID} from "node:crypto";
import {priceCatalog} from "./pricing.mjs";
import {isInstagramLikes,statusOfItems} from "./choosePosts.mjs";
import {sendOwnerPurchaseNotification} from "./ownerNotifications.mjs";

export const chooseSql=()=>neon(process.env.LITIX_CHOOSE_POSTS_DATABASE_URL||
 process.env.LITIX_V2_DATABASE_URL||process.env.LITIX_AUTOLIKES_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL||"");
export const chooseDatabaseReady=()=>Boolean(process.env.LITIX_CHOOSE_POSTS_DATABASE_URL||
 process.env.LITIX_V2_DATABASE_URL||process.env.LITIX_AUTOLIKES_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL);
export const sha=value=>createHash("sha256").update(String(value)).digest("hex");
export const choiceId=()=> "ltx2_"+randomUUID();
export const privateToken=()=>randomUUID()+"-"+randomUUID();
export const previewDemo=()=>process.env.VERCEL_ENV==="preview"&&process.env.LITIX_CHOOSE_POSTS_PREVIEW_DEMO==="true";
const apiEndpoint=()=>{
 const url=new URL(process.env.SMMGLOB_API_URL||"https://smmglob.com/api/v2");
 if(url.protocol!=="https:"||!["smmglob.com","www.smmglob.com"].includes(url.hostname))throw Error("Unapproved supplier host");
 return url;
};
export async function supplier(action,params={}){
 if(!process.env.SMMGLOB_API_KEY)throw Error("Supplier unavailable");
 const response=await fetch(apiEndpoint(),{method:"POST",cache:"no-store",signal:AbortSignal.timeout(15000),
  headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({key:process.env.SMMGLOB_API_KEY,action,...params})});
 if(!response.ok)throw Error("Supplier HTTP "+response.status);
 const result=await response.json();
 if(result?.error)throw Object.assign(Error("Supplier rejected request"),{rejected:true});
 return result;
}
export async function getCurrentLikesService(id){
 const rows=await supplier("services");
 if(!Array.isArray(rows))throw Error("Live supplier catalog unavailable");
 const candidate=priceCatalog(rows).items.find(x=>String(x.service)===String(id));
 if(!candidate||!isInstagramLikes(candidate))throw Error("The selected Likes service is not currently available");
 return candidate;
}
export async function getPreviewService(id){
 const p=String(id||"");
 if(!/^\d{1,12}$/.test(p))throw Error("Invalid service");
 for(let page=1;page<=5;page++){
  const response=await fetch("https://www.litix.net/api/catalog/v1?platform=Instagram&kind=likes&page="+page,
   {cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!response.ok)break;
  const v=await response.json();
  const found=(v.items||[]).find(s=>String(s.id)===p&&s.purchasable===true&&isInstagramLikes(s));
  if(found)return {service:p,name:found.name,category:found.category,type:"Default",rate:undefined,
   pricedRetail:Number(found.per1000),min:Number(found.supplierMin),max:Number(found.max),step:Number(found.unitStep||1)};
  if(page*24>=Number(v.total||0))break;
 }
 throw Error("Service unavailable in public catalog");
}
const emailKey=()=>process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY||"";
const escapeHTML=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function email(to,subject,body,idempotencyKey){
 if(!emailKey())throw Error("Resend not configured");
 const res=await fetch("https://api.resend.com/emails",{
  method:"POST",cache:"no-store",signal:AbortSignal.timeout(8000),
  headers:{"authorization":"Bearer "+emailKey(),"content-type":"application/json","Idempotency-Key":idempotencyKey},
  body:JSON.stringify({from:"Litix <orders@litix.net>",to:Array.isArray(to)?to:[to],subject,text:body,
    html:"<div style='font-family:Arial,sans-serif;white-space:pre-wrap'>"+escapeHTML(body)+"</div>"})});
 if(!res.ok)throw Error("Email provider HTTP "+res.status);
}
export async function sendChooseReceipt(orderId,token){
 const sql=chooseSql();
 const found=await sql.query("select id,email,username,service_name,quantity_each,total_cents,payment_state from public.litix_choose_posts_orders where id=$1 and payment_state='paid'",[orderId]);
 if(!found.length)return false;
 const x=found[0];
 const url="https://www.litix.net/choose-posts/track?order="+encodeURIComponent(orderId)+"&token="+encodeURIComponent(token);
 const text=["Your Litix Instagram Choose Your Posts receipt","Order: "+orderId,
  "Service: "+x.service_name,"Account: @"+x.username,
  "Likes per post: "+x.quantity_each,"Total: USD $"+(Number(x.total_cents)/100).toFixed(2),
  "Payment: approved","Track each selected post: "+url,
  "Supplier processing and delivery are not guaranteed. Save this private link; do not share it."].join("\n");
 await email(x.email,"Litix paid Instagram posts order — "+orderId,text,"litix-choose-posts-receipt/"+orderId);
 return true;
}
async function alertReview(orderId,reason){
 const rows=await chooseSql().query("select email,service_name,total_cents from public.litix_choose_posts_orders where id=$1",[orderId]);
 if(!rows.length)return;
 await email(["litixsocial@gmail.com","litgnosisllc@gmail.com"],"Litix Choose Posts: manual review — "+orderId,
  "Order: "+orderId+"\nCustomer: "+rows[0].email+"\nService: "+rows[0].service_name+
  "\nReason: "+String(reason).slice(0,170)+"\nDo not resubmit UNKNOWN_OUTCOME items until reconciled with SMMGLOB.",
  "litix-choose-posts-review/"+orderId);
}
export async function notifyPaid(orderId,token){
 const sql=chooseSql();
 const rows=await sql.query("select id,email,service_name,total_cents,quantity_each,username from public.litix_choose_posts_orders where id=$1 and payment_state='paid'",[orderId]);
 if(!rows.length)return false;
 const x=rows[0];
 const counts=await sql.query("select count(*)::int as count from public.litix_choose_posts_items where order_id=$1",[orderId]);
 await Promise.allSettled([
  sendChooseReceipt(orderId,token),
  sendOwnerPurchaseNotification({orderId,purchaseDate:new Date().toISOString(),customerEmail:x.email,serviceName:x.service_name+" · Choose Posts",
   quantity:String(x.quantity_each)+" likes × "+counts[0].count+" posts",amountCents:Number(x.total_cents),
   customerProfile:"@"+x.username,paymentStatus:"paid",fulfillmentInstructions:"Individual post orders dispatch after payment; review failures in litix_choose_posts_items."})
 ]);
 return true;
}
export async function dispatchPaidPosts(orderId){
 const sql=chooseSql();
 const rows=await sql.query("select i.id,i.post_url,i.quantity,o.service_id from public.litix_choose_posts_items i join public.litix_choose_posts_orders o on o.id=i.order_id where i.order_id=$1 and o.payment_state='paid' and i.state='QUEUED' order by i.ordinal",[orderId]);
 // Process up to four independently, bounded to Vercel function duration.
 let idx=0;
 async function worker(){
  while(idx<rows.length){
   const item=rows[idx++];const started=await sql.query(
    "update public.litix_choose_posts_items set state='DISPATCHING',attempt_count=attempt_count+1,attempt_started_at=now(),updated_at=now() where id=$1 and state='QUEUED' and exists (select 1 from public.litix_choose_posts_orders where id=$2 and payment_state='paid') returning attempt_count",[item.id,orderId]);
   if(!started.length)continue;
   const attempt=String(started[0].attempt_count),attemptId=randomUUID();
   try{await sql.query("insert into public.litix_choose_posts_attempts(id,item_id,attempt_number,state) values($1,$2,$3,'STARTED')",[attemptId,item.id,Number(attempt)]);}
   catch{await sql.query("update public.litix_choose_posts_items set state='MANUAL_REVIEW',last_error='Audit ledger unavailable' where id=$1",[item.id]).catch(()=>{});continue;}
   let result;
   try{
    result=await supplier("add",{service:String(item.service_id),link:item.post_url,quantity:String(item.quantity)});
    if(!result?.order)throw Error("Supplier result missing unique order ID");
   }catch(error){
    const certain=error?.rejected===true;
    await Promise.allSettled([
     sql.query("update public.litix_choose_posts_attempts set state=$2,error_code=$3,finished_at=now() where id=$1",[attemptId,certain?"REJECTED":"UNKNOWN_OUTCOME",certain?"SUPPLIER_REJECTED":"UNCONFIRMED"]),
     sql.query("update public.litix_choose_posts_items set state=$2,last_error=$3,updated_at=now() where id=$1",[item.id,certain?"RETRYABLE":"UNKNOWN_OUTCOME",certain?"Supplier explicitly rejected this item":"Supplier outcome unconfirmed; reconcile before retry"])
    ]);
    continue;
   }
   await Promise.allSettled([
    sql.query("update public.litix_choose_posts_items set supplier_order_id=$2,state='SUBMITTED',supplier_status=$3::jsonb,updated_at=now() where id=$1",[item.id,String(result.order),JSON.stringify(result)]),
    sql.query("update public.litix_choose_posts_attempts set state='CONFIRMED',supplier_order_id=$2,finished_at=now() where id=$1",[attemptId,String(result.order)])
   ]);
  }
 }
 await Promise.all(Array.from({length:Math.min(4,rows.length)},()=>worker()));
 const items=await sql.query("select state from public.litix_choose_posts_items where order_id=$1",[orderId]);
 const status=statusOfItems(items);
 await sql.query("update public.litix_choose_posts_orders set fulfillment_state=$2,updated_at=now() where id=$1",[orderId,status]);
 if(["manual_review","partial"].includes(status))await alertReview(orderId,status).catch(()=>{});
 return {status,items};
}
