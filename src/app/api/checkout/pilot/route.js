// Litix-owned $1 creative-kit pilot. Never accepts reseller service IDs,
// raw card numbers, or user-supplied amounts; never marks a sale "settled"
// from a gateway approval response. A unique ID authorizes at most one sale.
import {neon} from "@neondatabase/serverless";
import {createHmac,createHash,timingSafeEqual} from "node:crypto";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const USD_CENTS=100, NODE="litix-direct-primary-01";
const FIELDS=["brand","campaign","audience","pain","solution","cta","landingUrl"];
const GATEWAY="https://paykings.transactiongateway.com";
const res=(v,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex, nofollow"}});
const dsn=()=>process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||"";
const db=()=>neon(dsn());
const secret=()=>String(process.env.NMI_SECURITY_KEY||"");
const enabled=()=>process.env.VERCEL_ENV==="production"&&process.env.LITIX_DOLLAR_PILOT_ENABLED==="true"&&
 !!dsn()&&secret().length>=16&&process.env.NMI_GATEWAY_MODE!=="TEST";
const sha=s=>createHash("sha256").update(s).digest("hex");
const hmac=s=>createHmac("sha256",secret()).update(s).digest("hex");
const sameOrigin=req=>{try{return new URL(req.headers.get("origin")).origin===new URL(req.url).origin}catch{return false}};
const tokenOk=(order,email,presented)=>{
 if(!/^[0-9a-f]{64}$/.test(presented||""))return false;
 const actual=Buffer.from(hmac("pilot-access:"+order+":"+email),"hex");
 return timingSafeEqual(actual,Buffer.from(presented,"hex"));
};
const parseTag=(xml,tag)=>new RegExp("<"+tag+">([^<]{0,300})</"+tag+">","i").exec(xml)?.[1]?.trim()||"";

async function nodeReady(sql){
 const rows=await sql.query(`SELECT 1 FROM public.master_execution_nodes
 WHERE id=$1 AND owned=true AND enabled=true AND last_seen>NOW()-INTERVAL '90 seconds' LIMIT 1`,[NODE]);
 return rows.length===1;
}
async function validateBrief(brief){
 if(!brief||typeof brief!=="object"||Array.isArray(brief))return null;
 const safe={};
 for(const field of FIELDS){
  const val=brief[field];
  if(typeof val!=="string"||val.trim().length<3||val.length>350)return null;
  safe[field]=val.trim();
 }
 try {
  const url=new URL(safe.landingUrl);
  if(url.protocol!=="https:"||url.username||url.password||!url.hostname.includes("."))return null;
 }catch{return null}
 return safe;
}
async function nmiSettled(orderId,transactionId){
 // A read-only gateway query; merchant authorization alone is not settlement.
 if(!/^\d{5,32}$/.test(transactionId))return false;
 let xml;
 try{
  const response=await fetch(GATEWAY+"/api/query.php",{
   method:"POST",cache:"no-store",redirect:"error",
   headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({security_key:secret(),report_type:"transaction",transaction_id:transactionId}),
   signal:AbortSignal.timeout(11000)
  });
  if(!response.ok)return false;
  xml=await response.text();
 }catch{return false}
 if(!xml||xml.length>150000)return false;
 const t=/<transaction(?:\s[^>]*)?>([\s\S]*?)<\/transaction>/i.exec(xml)?.[1]||"";
 if(parseTag(t,"transaction_id")!==transactionId||parseTag(t,"order_id")!==orderId||parseTag(t,"condition")!=="complete")return false;
 if(parseTag(t,"currency")&&parseTag(t,"currency")!=="USD")return false;
 const actions=[...t.matchAll(/<action(?:\s[^>]*)?>([\s\S]*?)<\/action>/gi)].map(m=>m[1]);
 const sale=actions.some(a=>parseTag(a,"action_type")==="sale"&&parseTag(a,"success")==="1"&&
  parseTag(a,"response_code")==="100"&&parseTag(a,"amount")==="1.00");
 const settled=actions.some(a=>parseTag(a,"action_type")==="settle"&&parseTag(a,"success")==="1");
 return sale&&settled;
}
async function releaseAfterSettlement(sql,order){
 const body=JSON.stringify({brief:order.payload.brief,isSyntheticTest:false});
 const hash=sha(body);
 const stmt=`WITH settled AS (
  INSERT INTO growth_ops.litix_nmi_settled_transactions(transaction_id,event_id)
  VALUES ($1,$2) ON CONFLICT(transaction_id) DO NOTHING RETURNING transaction_id
 ), authorized AS (
  INSERT INTO public.master_fulfillment_grants(order_id,kind,verification_source,verified_at)
  SELECT $3,'website_preview','nmi_query_settled',NOW() FROM settled
  ON CONFLICT(order_id) DO NOTHING RETURNING order_id
 ), approved AS (
  UPDATE growth_ops.litix_owned_payment_intents
  SET execution_approved=true,state='dispatch_pending',updated_at=NOW()
  WHERE order_id=$3 AND state='awaiting_settlement'
    AND EXISTS (SELECT 1 FROM authorized) RETURNING order_id,tenant_key
 ), created_job AS (
  INSERT INTO public.master_node_jobs(order_id,tenant_key,kind,payload,payload_hash,status)
  SELECT order_id,tenant_key,'website_preview',$4::jsonb,$5,'queued' FROM approved
  ON CONFLICT(order_id) DO NOTHING RETURNING id,order_id
 ), dispatched AS (
  INSERT INTO growth_ops.litix_payment_dispatch_outbox(order_id,job_id)
  SELECT order_id,id FROM created_job ON CONFLICT(order_id) DO NOTHING RETURNING order_id
 ) SELECT (SELECT COUNT(*) FROM dispatched)::int AS queued`;
 return (await sql.query(stmt,[order.provider_transaction_id,
  "nmi-query-"+order.order_id,order.order_id,body,hash]))[0]?.queued===1;
}

export async function GET(request){
 const url=new URL(request.url),orderId=url.searchParams.get("order"),access=url.searchParams.get("token")||"";
 if(!orderId){
  if(!enabled())return res({enabled:false,amountCents:USD_CENTS,chargeAttempted:false});
  try{
   const ready=await nodeReady(db());
   return res({enabled:ready,amountCents:USD_CENTS,product:"12 original Litix marketing drafts",
    deliveredBy:"Litix first-party worker",paymentMode:"LIVE",socialLikesOrFollowers:false});
  }catch{return res({enabled:false,amountCents:USD_CENTS,chargeAttempted:false},503)}
 }
 if(!/^lpx_[0-9a-f]{32}$/.test(orderId)||!secret())return res({error:"invalid_tracking"},400);
 const sql=db();
 let order;
 try{
  order=(await sql.query(`SELECT order_id,provider_transaction_id,state,payload,expected_amount_cents
    FROM growth_ops.litix_owned_payment_intents WHERE order_id=$1 LIMIT 1`,[orderId]))[0];
 }catch{return res({error:"tracking_unavailable"},503)}
 if(!order||!tokenOk(orderId,String(order.payload?.email||""),access))return res({error:"order_not_found"},404);
 if(order.state==="awaiting_settlement"&&process.env.VERCEL_ENV==="production"&&secret().length>=16&&/^\d{5,32}$/.test(order.provider_transaction_id)){
  if(await nmiSettled(orderId,order.provider_transaction_id)){
   try{await releaseAfterSettlement(sql,order);order.state="dispatch_pending"}
   catch{order.state="awaiting_settlement"}
  }
 }
 let job;
 try{
  job=(await sql.query(`SELECT j.id,j.status,j.result,a.content AS artifact
     FROM public.master_node_jobs j
     LEFT JOIN public.master_private_artifacts a ON a.job_id=j.id
     WHERE j.order_id=$1 LIMIT 1`,[orderId]))[0];
 }catch{}
 let kit=null;
 if(job?.status==="succeeded"&&job.artifact){
  try{kit=JSON.parse(job.artifact).kit||null}catch{}
 }
 return res({orderId,payment:order.state==="dispatch_pending"?"settled":
  order.state==="awaiting_settlement"?"approved_awaiting_settlement":"requires_review",
  fulfillment:job?.status||"not_dispatched",delivered:!!kit,kit,
  chargeRetried:false,amountCents:USD_CENTS});
}

export async function POST(request){
 if(!enabled())return res({error:"pilot_checkout_not_ready",chargeAttempted:false},503);
 if(!sameOrigin(request))return res({error:"same_origin_required",chargeAttempted:false},403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
  return res({error:"json_required",chargeAttempted:false},415);
 if(Number(request.headers.get("content-length")||0)>7000)
  return res({error:"request_too_large",chargeAttempted:false},413);
 let d;
 try{d=await request.json()}catch{return res({error:"invalid_request",chargeAttempted:false},400)}
 const email=String(d?.email||"").trim().toLowerCase();
 const idem=String(d?.idempotencyKey||"");
 const paymentToken=String(d?.paymentToken||"");
 const brief=await validateBrief(d?.brief);
 if(d?.product!=="website_preview"||d?.amountCents!==USD_CENTS||
  !/^[^\s@]{1,64}@[^\s@]{3,200}\.[a-z]{2,24}$/i.test(email)||
  !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(idem)||
  paymentToken.length<10||paymentToken.length>600||!brief)
  return res({error:"invalid_product_or_checkout_details",chargeAttempted:false},422);
 const orderId="lpx_"+hmac("pilot-order:"+idem+":"+email).slice(0,32);
 const access=hmac("pilot-access:"+orderId+":"+email),sql=db();
 try{
  if(!await nodeReady(sql))return res({error:"first_party_delivery_node_offline",chargeAttempted:false},503);
  const count=(await sql.query(`SELECT COUNT(*)::int AS n
    FROM growth_ops.litix_owned_payment_intents
    WHERE payload->>'email'=$1 AND created_at>NOW()-INTERVAL '24 hours'`,[email]))[0]?.n||0;
  if(count>=3)return res({error:"pilot_daily_limit",chargeAttempted:false},429);
  const inserted=await sql.query(`INSERT INTO growth_ops.litix_owned_payment_intents
    (order_id,provider,provider_transaction_id,expected_amount_cents,currency,
     live_mode,execution_approved,service_kind,payload,tenant_key,state)
     VALUES($1,'nmi',$2,100,'USD',true,false,'website_preview',$3::jsonb,'litix-pilot','pending')
     ON CONFLICT(order_id) DO NOTHING RETURNING order_id`,
     [orderId,"reserved:"+orderId,JSON.stringify({email,brief,isSyntheticTest:false})]);
  if(!inserted.length)return res({error:"existing_pilot_order_use_status_link",
    orderId,token:access,chargeAttempted:false},409);
 }catch{return res({error:"pilot_ledger_unavailable",chargeAttempted:false},503)}
 let gateway;
 try{
  const response=await fetch(GATEWAY+"/api/transact.php",{
   method:"POST",cache:"no-store",redirect:"error",
   headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({security_key:secret(),type:"sale",amount:"1.00",
     orderid:orderId,email,payment_token:paymentToken}),
   signal:AbortSignal.timeout(18000)
  });
  if(!response.ok)throw Error("gateway_http_error");
  const raw=await response.text();
  if(raw.length>2000)throw Error("gateway_response_oversize");
  gateway=new URLSearchParams(raw);
 }catch{
  await sql.query(`UPDATE growth_ops.litix_owned_payment_intents
   SET state='requires_review',updated_at=NOW() WHERE order_id=$1`,[orderId]).catch(()=>{});
  return res({error:"gateway_result_unknown_do_not_retry",orderId,token:access,
    chargeAttempted:true},202);
 }
 const txn=String(gateway.get("transactionid")||"");
 if(gateway.get("response")!=="1"||gateway.get("response_code")!=="100"||!/^[0-9]{5,32}$/.test(txn)){
  await sql.query(`UPDATE growth_ops.litix_owned_payment_intents
   SET state='requires_review',updated_at=NOW() WHERE order_id=$1`,[orderId]).catch(()=>{});
  return res({error:"payment_not_approved_or_requires_review",orderId,token:access,
   chargeAttempted:true},402);
 }
 try{
  // Only an approved sale is recorded here. Fulfillment remains gated on an
  // independently queried, genuinely settled merchant transaction.
  await sql.transaction([
   sql`UPDATE growth_ops.litix_owned_payment_intents
    SET provider_transaction_id=${txn},state='awaiting_settlement',updated_at=NOW()
    WHERE order_id=${orderId} AND state='pending'`,
   sql`INSERT INTO growth_ops.litix_nmi_sale_receipts(order_id,transaction_id,amount_cents,currency)
    VALUES(${orderId},${txn},100,'USD') ON CONFLICT(order_id) DO NOTHING`
  ]);
 }catch{return res({error:"approved_sale_needs_ledger_reconciliation_do_not_retry",
   orderId,token:access,chargeAttempted:true},202)}
 return res({orderId,token:access,payment:"approved_awaiting_settlement",
  fulfillment:"not_dispatched",amountCents:USD_CENTS,chargeAttempted:true,
  trackingUrl:"/pilot?order="+encodeURIComponent(orderId)+"&token="+access},202);
}
