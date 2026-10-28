import {randomUUID} from "node:crypto";
import {after} from "next/server";
import {normalizePosts,quoteSelectedPosts,instagramUsername} from "../../../../lib/choosePosts.mjs";
import {chooseSql,chooseDatabaseReady,sha,choiceId,privateToken,previewDemo,getPreviewService,getCurrentLikesService,notifyPaid,dispatchPaidPosts} from "../../../../lib/choosePostsServer.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const output=(v,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
const gatewayMode=()=>process.env.VERCEL_ENV==="preview"||process.env.VERCEL_ENV==="development"?"TEST":"PRODUCTION";
const validTestGateway=()=>{
 try{const u=new URL(process.env.NMI_TEST_GATEWAY_URL||"");return u.protocol==="https:"&&u.hostname!=="paykings.transactiongateway.com";}catch{return false;}
};
const cardConfigured=()=>gatewayMode()==="TEST"
 ?Boolean(validTestGateway()&&process.env.NMI_TEST_SECURITY_KEY&&(process.env.NMI_TEST_COLLECT_PUBLIC_KEY||process.env.NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY))
 :Boolean(process.env.NMI_SECURITY_KEY&&(process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY));
export async function GET(){
 return output({demo:previewDemo(),paymentReady:false,releaseBlocked:"Boostero multi-post checkout adapter and recovery tests not complete",
  publicKey:gatewayMode()==="TEST"?(process.env.NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY||process.env.NMI_TEST_COLLECT_PUBLIC_KEY||null)
   :(process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY||null),
  customerPaymentMode:gatewayMode(),minimumCheckoutCents:500});
}
export async function POST(req){
 const origin=req.headers.get("origin");
 if(origin&&origin!==new URL(req.url).origin)return output({error:"Cross-site checkout denied."},403);
 if(!previewDemo())return output({error:"Choose Posts is a preview only. Boostero multi-post paid checkout has not been released; no charge submitted."},503);
 if(!chooseDatabaseReady())return output({error:"Choose Posts database not configured. No charge submitted."},503);
 let x,raw;
 try{raw=await req.text();if(raw.length>13000)return output({error:"Request too large."},413);x=JSON.parse(raw);}
 catch{return output({error:"Invalid JSON checkout request."},400);}
 const username=instagramUsername(x?.username),email=String(x?.email||"").trim().toLowerCase();
 const serviceId=String(x?.serviceId||""),idem=String(x?.idempotencyKey||"");
 if(x?.simulate!==true)return output({error:"Live multi-post payments are disabled. Preview simulation only; no charge submitted."},503);
 const demo=previewDemo()&&x?.simulate===true;
 if(!username||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!/^\d{1,12}$/.test(serviceId)
  ||!/^[a-f0-9-]{36}$/.test(idem))return output({error:"Valid account, service, email, and checkout ID required."},400);
 if(!demo&&!cardConfigured())return output({error:"Secure test/production gateway not configured. No charge submitted."},503);
 const token=String(x?.paymentToken||"");
 if(!demo&&(token.length<10||token.length>500))return output({error:"Complete tokenized card fields first."},422);
 let posts,service,quote;
 try{
  posts=normalizePosts(x?.posts);
  service=demo?await getPreviewService(serviceId):await getCurrentLikesService(serviceId);
  quote=quoteSelectedPosts({service,quantityEach:x?.quantityEach,postURLs:posts,checkWholesale:!demo});
 }catch(e){return output({error:String(e.message||"Live quote not available").slice(0,180)},422);}
 if(!Number.isSafeInteger(x.expectedAmountCents)||x.expectedAmountCents!==quote.totalCents)
  return output({error:"The price or quantity changed. Recheck your total; no charge submitted."},409);
 const orderId=choiceId(),secret=privateToken();
 const fingerprint=sha(JSON.stringify({username:username.toLowerCase(),email,serviceId,posts:quote.posts,quantityEach:quote.quantityEach,totalCents:quote.totalCents}));
 const itemRows=quote.posts.map((post,i)=>({id:randomUUID(),ordinal:i+1,url:post,quantity:quote.quantityEach,cents:quote.eachCents}));
 const sql=chooseSql();
 try{
  const rows=await sql.query(
   "with parent as (insert into public.litix_choose_posts_orders(id,email,username,service_id,service_name,quantity_each,per1000,total_cents,idempotency_key,request_hash,tracking_token_hash) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(idempotency_key) do nothing returning id), created as (insert into public.litix_choose_posts_items(id,order_id,ordinal,post_url,quantity,amount_cents) select j.id,parent.id,j.ordinal,j.url,j.quantity,j.cents from parent cross join jsonb_to_recordset($12::jsonb) as j(id text,ordinal integer,url text,quantity integer,cents integer) returning id) select count(*)::int as total from created",
   [orderId,email,username,serviceId,String(service.name).slice(0,220),quote.quantityEach,quote.per1000,quote.totalCents,idem,fingerprint,sha(secret),JSON.stringify(itemRows)]);
  if(Number(rows[0]?.total)!==itemRows.length)return output({error:"This checkout ID was already used. Do not pay twice."},409);
  if(demo){
   await sql.query("update public.litix_choose_posts_orders set payment_state='simulated',fulfillment_state='preview_only' where id=$1",[orderId]);
   return output({orderId,secret,payment:"simulated",fulfillment:"preview_only",postCount:quote.posts.length,
    totalCents:quote.totalCents,message:"Preview simulation complete: no card charged, no SMMGLOB orders placed."});
  }
  await sql.query("update public.litix_choose_posts_orders set payment_state='processing',payment_attempted_at=now() where id=$1 and payment_state='created'",[orderId]);
 }catch{
  return output({error:"Order database unavailable. No charge submitted."},503);
 }
 const test=gatewayMode()==="TEST";
 const gatewayKey=test?process.env.NMI_TEST_SECURITY_KEY:process.env.NMI_SECURITY_KEY;
 const gatewayUrl=test?process.env.NMI_TEST_GATEWAY_URL:"https://paykings.transactiongateway.com/api/transact.php";
 let payment;
 try{
  const r=await fetch(gatewayUrl,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},cache:"no-store",
   body:new URLSearchParams({security_key:gatewayKey,type:"sale",payment_token:token,amount:(quote.totalCents/100).toFixed(2),orderid:orderId,email}),
   signal:AbortSignal.timeout(18000)});
  if(!r.ok)throw Error("Gateway unavailable");
  payment=Object.fromEntries(new URLSearchParams(await r.text()));
 }catch{
  await sql.query("update public.litix_choose_posts_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});
  return output({orderId,secret,payment:"review",message:"Payment outcome unconfirmed. Do not pay again; contact support."},202);
 }
 if(String(payment.response)!=="1"){
  await sql.query("update public.litix_choose_posts_orders set payment_state='declined' where id=$1",[orderId]).catch(()=>{});
  return output({error:"Card payment declined. No supplier posts submitted."},402);
 }
 const transactionId=String(payment.transactionid||"").trim();
 if(!transactionId){
  await sql.query("update public.litix_choose_posts_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});
  return output({orderId,secret,payment:"review",message:"Approval without payment reference; reconciliation required. Do not retry."},202);
 }
 try{
  await sql.query("update public.litix_choose_posts_orders set payment_state='paid',payment_transaction_id=$2,fulfillment_state='dispatching' where id=$1 and payment_state='processing'",[orderId,transactionId]);
  await sql.query("update public.litix_choose_posts_items set state='QUEUED' where order_id=$1 and state='PENDING_PAYMENT'",[orderId]);
 }catch{
  return output({orderId,secret,payment:"paid",fulfillment:"manual_review",message:"Payment approved; fulfillment held for database reconciliation. Do not pay again."},202);
 }
 after(async()=>{
  await Promise.allSettled([notifyPaid(orderId,secret),dispatchPaidPosts(orderId)]);
 });
 return output({orderId,secret,payment:"paid",fulfillment:"dispatching",
  postCount:quote.posts.length,totalCents:quote.totalCents,message:"Payment approved once. Each selected post is queued for individual supplier processing."},200);
}
