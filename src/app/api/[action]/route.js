import { neon } from "@neondatabase/serverless";
import { randomUUID, createHash } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
let servicesCache = [], updated = 0;
const send = (v,s=200) => Response.json(v,{status:s,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const hash = v => createHash("sha256").update(String(v)).digest("hex");
const conn = () => process.env.LITIX_V2_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
const db = () => neon(conn());
const conf = () => ({database:!!conn(),supplier:!!process.env.SMMGLOB_API_KEY,payment:!!(process.env.NMI_SECURITY_KEY&&process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY)});
const name = req => new URL(req.url).pathname.split("/").pop();
const bounded = (v,n=120) => String(v??"").trim().slice(0,n);
async function smm(action,params={}) {
 const u = new URL(process.env.SMMGLOB_API_URL || "https://smmglob.com/api/v2");
 if (!process.env.SMMGLOB_API_KEY || u.protocol!=="https:" || !["smmglob.com","www.smmglob.com"].includes(u.hostname)) throw Error("SmmGlob supplier configuration invalid");
 const r = await fetch(u,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({key:process.env.SMMGLOB_API_KEY,action,...params}),cache:"no-store",signal:AbortSignal.timeout(16000)});
 if(!r.ok) throw Error("Supplier returned HTTP "+r.status);
 const obj=await r.json(); if(obj?.error) throw Error(String(obj.error).slice(0,160)); return obj;
}
const truth = v => v === true || String(v).toLowerCase() === "true" || String(v) === "1";
const hasRefill = x => truth(x.refill) || truth(x.refillable) || truth(x.auto_refill) || truth(x.autorefill);
const hasNoDrop = x => {
 const evidence = [x.name,x.category,x.description,x.desc,x.notes,x.terms].map(v=>String(v||"")).join(" ");
 return /no[ -]?drop|drop[ -]?protection|no[ -]?drop guarantee/i.test(evidence) ||
   truth(x.no_drop) || truth(x.noDrop) || truth(x.drop_protection) || truth(x.no_drop_guarantee);
};
async function getServices(){
 if(servicesCache.length&&Date.now()-updated<300000)return servicesCache;
 try {
  const s=await smm("services");
  if(!Array.isArray(s))throw Error("Invalid service response");
  servicesCache=s.filter(x=>{
   const label=[x.name,x.category,x.description,x.desc,x.platform].map(v=>String(v||"")).join(" ");
   const meta=[x.country,x.region,x.location,x.geo,x.audience,x.target,x.service_type].map(v=>String(v||"")).join(" ");
   const regular=/^(default|regular|standard)$/i.test(String(x.type||"Default"))||/\b(regular|standard)\b/i.test(label);
   const usa=/(\busa\b|u\.s\.a\.|united states|american|\bus\b)/i.test(label+" "+meta);
   return x.service!=null&&Number.isFinite(Number(x.rate))&&Number(x.rate)>0&&Number(x.min)>0&&Number(x.max)>=Number(x.min)&&regular&&usa&&hasRefill(x);
  });
  updated=Date.now();
  return servicesCache;
 } catch(e) {
  if(servicesCache.length&&Date.now()-updated<1200000)return servicesCache;
  throw e;
 }
}
function shape(x){return {id:String(x.service),name:String(x.name||"Service"),category:String(x.category||"Other"),type:String(x.type||"Default"),min:Number(x.min),max:Number(x.max),per1000:Number(x.rate)*11,refill:hasRefill(x),noDrop:hasNoDrop(x),purchasable:/^default$/i.test(String(x.type||"Default"))};}
export async function GET(req){
 const op=name(req),flags=conf(),p=new URL(req.url).searchParams;
 if(!["config","health","smmservices","track"].includes(op))return send({error:"Unknown route"},404);
 if(op==="config")return send({ready:flags.database&&flags.supplier&&flags.payment,publicKey:flags.payment?process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY:null});
 if(op==="health"){let database=false;if(flags.database)try{await db().query("select 1",[]);database=true}catch{}return send({service:"litix-v2",database,supplierConfigured:flags.supplier,paykingsConfigured:flags.payment,liveTransactionVerified:false,ready:database&&flags.supplier&&flags.payment},database?200:503)}
 if(op==="smmservices"){
  const cat=bounded(p.get("category"),100),term=bounded(p.get("q"),120).toLowerCase(),page=Math.max(1,Math.min(10000,Number(p.get("page"))||1));
  try{const all=await getServices(),filtered=all.filter(x=>(!cat||String(x.category||"Other")===cat)&&(!term||[x.service,x.name,x.category].some(z=>String(z||"").toLowerCase().includes(term))));return send({items:filtered.slice((page-1)*24,page*24).map(shape),categories:[...new Set(all.map(x=>String(x.category||"Other")))].sort(),total:filtered.length,allCount:all.length,page})}
  catch(e){console.error("SmmGlob catalog unavailable",String(e?.message||"").slice(0,100));return send({error:"Live supplier catalog unavailable",items:[],categories:[],total:0},503)}
 }
 if(op==="track"){
  const id=bounded(p.get("id"),80),secret=bounded(p.get("token"),150);
  if(!/^ltx2_[a-f0-9-]{36}$/.test(id)||secret.length<25||secret.length>150)return send({error:"Invalid private tracking link"},400);
  let rows,sql;try{sql=db();rows=await sql.query("select id,service_name,quantity,amount_cents,payment_state,fulfillment_state,supplier_order_id,last_supplier_status from litix_v2_orders where id=$1 and tracking_token_hash=$2",[id,hash(secret)])}catch{return send({error:"Tracking database temporarily unavailable"},503)}
  if(!rows.length)return send({error:"Order not found"},404);const x=rows[0];
  if(x.supplier_order_id)try{const stat=await smm("status",{order:String(x.supplier_order_id)}),status=String(stat.status||"").toLowerCase(),fulfillment=status==="completed"?"completed":status==="partial"?"partial":status==="in progress"?"in_progress":x.fulfillment_state;await sql.query("update litix_v2_orders set last_supplier_status=$2::jsonb,fulfillment_state=$3 where id=$1",[id,JSON.stringify(stat),fulfillment]);x.fulfillment_state=fulfillment;x.last_supplier_status=stat}catch{}
  return send({order:{id:x.id,service:x.service_name,quantity:x.quantity,amount:(Number(x.amount_cents)/100).toFixed(2),payment:x.payment_state,fulfillment:x.fulfillment_state,status:x.last_supplier_status?.status||"",remains:x.last_supplier_status?.remains??null}});
 }
}
export async function POST(req){
 if(name(req)!=="checkout")return send({error:"Unknown action"},404);
 const flags=conf();if(!flags.database||!flags.supplier||!flags.payment)return send({error:"Secure checkout is temporarily unavailable"},503);
 let x;try{x=await req.json()}catch{return send({error:"Invalid JSON"},400)}
 const id=bounded(x.serviceId,32),qty=Number(x.quantity),email=bounded(x.email,250).toLowerCase(),link=bounded(x.link,1200),token=bounded(x.paymentToken,500),idem=bounded(x.idempotencyKey,36);let target;try{target=new URL(link)}catch{}
 if(!/^[0-9]+$/.test(id)||!Number.isSafeInteger(qty)||qty<1||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!target||target.protocol!=="https:"||!target.hostname.includes(".")||token.length<10||!/^[a-f0-9-]{36}$/.test(idem))return send({error:"Invalid service, quantity, public URL, email or payment information"},400);
 let service;try{service=(await getServices()).find(s=>String(s.service)===id)}catch{return send({error:"SmmGlob prices unavailable; no charge submitted"},503)}
 if(!service||!/^default$/i.test(String(service.type||"Default"))||qty<Number(service.min)||qty>Number(service.max))return send({error:"This service needs additional order information or a different quantity"},422);
 const cents=Math.max(100,Math.ceil(Number(service.rate)*qty/1000*1100));if(!Number.isSafeInteger(cents)||cents>100000000)return send({error:"Order total is outside supported limits"},422);
 if(!Number.isSafeInteger(x.expectedAmountCents)||x.expectedAmountCents!==cents)return send({error:"The price has changed. Refresh the catalog and confirm the new total before paying."},409);
 const orderId="ltx2_"+randomUUID(),secret=randomUUID()+"-"+randomUUID(),sql=db();
 try{const rows=await sql.query("insert into litix_v2_orders(id,email,service_id,service_name,category,destination,quantity,amount_cents,supplier_cost_cents,idempotency_key,tracking_token_hash,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) on conflict(idempotency_key) do nothing returning id",[orderId,email,id,String(service.name),String(service.category||"Other"),link,qty,cents,Math.ceil(Number(service.rate)*qty/10),idem,hash(secret),JSON.stringify({refill:!!service.refill})]);if(!rows.length)return send({error:"Payment already submitted; do not retry the same checkout"},409);await sql.query("update litix_v2_orders set payment_state='processing',payment_attempted_at=now() where id=$1",[orderId])}catch{return send({error:"Database unavailable; no charge submitted"},503)}
 let payment;try{const r=await fetch("https://paykings.transactiongateway.com/api/transact.php",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({security_key:process.env.NMI_SECURITY_KEY,type:"sale",payment_token:token,amount:(cents/100).toFixed(2),orderid:orderId,email}),signal:AbortSignal.timeout(18000),cache:"no-store"});if(!r.ok)throw Error("Payment gateway request failed");payment=Object.fromEntries(new URLSearchParams(await r.text()))}catch{await sql.query("update litix_v2_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});return send({orderId,secret,payment:"review",message:"Payment outcome is uncertain; do not retry or place a second order"},202)}
 if(String(payment.response)!=="1"){await sql.query("update litix_v2_orders set payment_state='declined' where id=$1",[orderId]).catch(()=>{});return send({error:"Payment declined: "+String(payment.responsetext||"Please contact your card issuer").slice(0,100)},402)}
 const transactionId=String(payment.transactionid||"").trim();if(!transactionId){await sql.query("update litix_v2_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});return send({orderId,secret,payment:"review",message:"Gateway reported approval without a transaction ID. Payment requires reconciliation; do not retry or place a second order."},202)}
 try{await sql.query("update litix_v2_orders set payment_state='paid',payment_transaction_id=$2 where id=$1",[orderId,transactionId]);await sql.query("update litix_v2_orders set fulfillment_state='dispatching',supplier_attempted_at=now() where id=$1 and supplier_attempted_at is null",[orderId])}catch{return send({orderId,secret,payment:"paid",fulfillment:"review",message:"Paid; supplier reconciliation required"},202)}
 try{const supplierResult=await smm("add",{service:id,link,quantity:String(qty)});if(!supplierResult?.order)throw Error("No supplier order ID");await sql.query("update litix_v2_orders set supplier_order_id=$2,fulfillment_state='submitted',last_supplier_status=$3::jsonb where id=$1",[orderId,String(supplierResult.order),JSON.stringify(supplierResult)]);return send({orderId,secret,payment:"paid",fulfillment:"submitted",message:"Payment approved and supplier order submitted"})}
 catch{await sql.query("update litix_v2_orders set fulfillment_state='manual_review' where id=$1",[orderId]).catch(()=>{});return send({orderId,secret,payment:"paid",fulfillment:"review",message:"Payment approved, but supplier outcome requires review. Do not reorder."},202)}
}
