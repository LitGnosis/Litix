import { priceCatalog, retailPer1000, supplierPricingInput, validateCheckoutQuote, servicePurchaseMinimum, minimumPurchaseQuantity, calculateOrderCents } from "../../../lib/pricing.mjs";
import {matchesServiceQuickKind,sortServicesPer1000} from "../../../lib/catalogSort.mjs";
import { neon } from "@neondatabase/serverless";
import { randomUUID, createHash } from "node:crypto";
import { after } from "next/server";
import { sendOrderEmails, notificationsConfigured } from "../../../lib/orderNotifications.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
let servicesCache = [], updated = 0, catalogFlight = null;
let supplierRawCount = 0, catalogLastError = null;
const send = (v,s=200) => Response.json(v,{status:s,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const hash = v => createHash("sha256").update(String(v)).digest("hex");
const conn = () => process.env.LITIX_V2_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
const db = () => neon(conn());
// Preview/Development payment requests are sandbox-only; production retains its existing gateway.
const selectedGatewayMode = () => ["preview","development"].includes(process.env.VERCEL_ENV) || process.env.NMI_GATEWAY_MODE === "TEST" ? "TEST" : "PRODUCTION";
const publicCollectKey = () => selectedGatewayMode()==="TEST"
  ? (process.env.NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY || process.env.NMI_TEST_COLLECT_PUBLIC_KEY)
  : (process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY || process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY);
const sandboxGatewayValid = () => {
  try { const u=new URL(process.env.NMI_TEST_GATEWAY_URL||"");return u.protocol==="https:"&&u.hostname!=="paykings.transactiongateway.com" }catch{return false}
};
const paymentConfigured = () => selectedGatewayMode()==="TEST"
  ? Boolean(process.env.NMI_TEST_SECURITY_KEY && sandboxGatewayValid() && publicCollectKey())
  : Boolean(process.env.NMI_SECURITY_KEY && publicCollectKey());
const conf = () => ({database:!!conn(),supplier:process.env.LITIX_BOOSTERO_ENABLED==="true"&&!!process.env.BOOSTERO_API_KEY,payment:paymentConfigured()});
const name = req => new URL(req.url).pathname.split("/").pop();
const bounded = (v,n=120) => String(v??"").trim().slice(0,n);
// Retired supplier integration: no outbound legacy provider API calls, ever.
// Historical orders are still read from our own database for tracking.
async function smm(){throw Error("Retired supplier is disabled; Boostero only.");}

const publicOrderId=id=>/^ltx2_[a-f0-9-]{36}$/.test(id);
const normalizeSupplierState=(state,current)=>{
 const s=String(state||"").trim().toLowerCase().replace(/[ _-]+/g," ");
 if(["completed","complete","finished"].includes(s))return "completed";
 if(["partial","partially completed"].includes(s))return "partial";
 if(["canceled","cancelled","refunded","failed","error"].includes(s))return s==="cancelled"?"canceled":s;
 if(["in progress","inprogress","working"].includes(s))return "in_progress";
 if(["processing","running"].includes(s))return "processing";
 if(["pending","waiting","queued","awaiting"].includes(s))return "pending";
 return current;
};
const publicOrder=(x,refresh={})=>{
 const stat=x.last_supplier_status||{};
 const remaining=stat.remains==null?null:Number(stat.remains);
 const validRemaining=Number.isFinite(remaining)&&Number.isInteger(remaining)&&remaining>=0&&remaining<=Number(x.quantity)?remaining:null;
 const supplierStatus=String(stat.status||"").trim();
 return {id:x.id,service:x.service_name,quantity:Number(x.quantity),amount:(Number(x.amount_cents)/100).toFixed(2),payment:x.payment_state,fulfillment:x.fulfillment_state,supplierOrderId:x.supplier_order_id||null,status:supplierStatus||null,remains:validRemaining,checkedAt:stat.checked_at||null,liveSupplierStatus:refresh.live===true,deliveryConfirmed:x.fulfillment_state==="completed",statusNote:refresh.warning||(!supplierStatus?"Supplier accepted the order; delivery is not confirmed yet.":"Supplier status is based on its most recent response.")};
};
async function refreshSupplierOrder(sql,x){
 // Only live Boostero orders may use the saved Boostero fulfillment record.
 // Historical orders retain their last persisted status without contacting
 // the retired supplier or mutating customer data.
 try{
  const provider=await sql.query(
   "select state,supplier_order_id,supplier_status,checked_at from public.litix_boostero_fulfillment where litix_order_id=$1",
   [x.id]);
  if(provider.length){
   const b=provider[0],mapped=String(b.state||"").toLowerCase();
   x.fulfillment_state=mapped==="submitted"?"processing":mapped==="unknown_outcome"?"manual_review":mapped;
   x.supplier_order_id=b.supplier_order_id||null;
   x.last_supplier_status={...b.supplier_status,provider:"boostero",
    checked_at:b.checked_at||b.supplier_status?.checked_at||null};
   return {live:false,warning:"Showing the last saved Boostero status. Delivery is not independently confirmed."};
  }
 }catch{return {live:false,warning:"Tracking is temporarily unavailable. Saved order history remains unchanged."};}
 return {live:false,warning:"Historical order: showing last saved status. No retired supplier requests are made."};
}

// Keep this check local: legacy numeric checkout is also loaded by the
// existing standalone no-charge gateway regression harness.
const legacyPublicServiceAllowed=service=>{
 if(process.env.VERCEL_ENV!=="production"||process.env.LITIX_BOOSTERO_ENABLED!=="true")return true;
 const title=String(service?.name||""),category=String(service?.category||"");
 const label=title+" "+category;
 if(!/\b(?:instagram|ig|tiktok|tik[\s-]*tok)\b/i.test(label))return true;
 const followers=/\bfollowers?\b/i.test(title)||(/\bfollowers?\b/i.test(category)&&!/\b(?:views?|likes?|comments?|shares?|saves?)\b/i.test(title));
 const likes=/\blikes?\b/i.test(title);
 return !(followers||likes);
};
const truth = v => v === true || String(v).toLowerCase() === "true" || String(v) === "1";
const hasRefill = x => truth(x.refill) || truth(x.refillable) || truth(x.auto_refill) || truth(x.autorefill);
const hasNoDrop = x => {
 const evidence = [x.name,x.category,x.description,x.desc,x.notes,x.terms].map(v=>String(v||"")).join(" ");
 return /no[ -]?drop|non[ -]?drop|drop[ -]?protection|no[ -]?drop guarantee|non[ -]?drop guarantee/i.test(evidence) ||
   truth(x.no_drop) || truth(x.noDrop) || truth(x.drop_protection) || truth(x.no_drop_guarantee);
};
async function refreshServices(allowStale=true){
 try {
  let s;
  try{s=await smm("services")}
  catch(error){
   // Safe retry ONLY for the read-only "services" action when a supplier
   // connection drops or times out. No retries of add/order/payment actions.
   const message=String(error?.message||error);
   if(!/terminated|timeout|fetch failed|network|ECONNRESET|socket hang up/i.test(message))throw error;
   console.warn("SMMGLOB read-only services connection interrupted; retrying once",{error:message.slice(0,90)});
   s=await smm("services");
  }
  if(!Array.isArray(s)||s.length===0)throw Error("Invalid or empty supplier service response");
  const eligible=priceCatalog(s).items.filter(x=>{
   if(["33771","33772","33773"].includes(String(x.service)))return false;
   const label=[x.name,x.category,x.description,x.desc,x.platform].map(v=>String(v||"")).join(" ");
   const meta=[x.country,x.region,x.location,x.geo,x.audience,x.target,x.service_type].map(v=>String(v||"")).join(" ");
   const regular=/^(default|regular|standard)$/i.test(String(x.type||"Default"))||/\b(regular|standard)\b/i.test(label);
   const usa=/(\busa\b|u\.s\.a\.|united states|american|\bus\b)/i.test(label+" "+meta);const outsideUS = /(?:usa\s*mix|mix\s*usa|worldwide|global|international|(?:usa|u\.s\.a\.|united states|\bus\b)\s*[/,+&-]\s*(?:uk|u\.k|united kingdom|asia|europe|canada|australia|worldwide|global)|(?:uk|u\.k|united kingdom|asia|europe|canada|australia)\s*[/,+&-]\s*(?:usa|u\.s\.a\.|united states|\bus\b))/i;
   const mixedGeography = outsideUS.test(label+" "+meta);
   const socialRequested=/(?:instagram|(?:^|[^a-z])ig(?:[^a-z]|$)|tik[\s-]*tok)/i.test(label)&&/\b(?:followers?|likes?|views?|shares?|reposts?|comments?)\b/i.test(label);return x.service!=null&&Number.isFinite(Number(x.rate))&&Number(x.rate)>0&&Number(x.min)>0&&Number(x.max)>=Number(x.min)&&regular&&(socialRequested||(usa&&!mixedGeography&&hasRefill(x)&&hasNoDrop(x)));
  });
  servicesCache=eligible;
  supplierRawCount=s.length;
  catalogLastError=null;
  updated=Date.now();
  return servicesCache;
 } catch(e) {
  catalogLastError=String(e?.message||e).slice(0,100);
  if(allowStale&&servicesCache.length&&Date.now()-updated<1200000)return servicesCache;
  throw e;
 }
}
// One refresh per instance; bounded stale data is returned while refreshing.
async function getServices(){
 const age=Date.now()-updated;
 if(servicesCache.length&&age<300000)return servicesCache;
 if(!catalogFlight)catalogFlight=refreshServices().finally(()=>{catalogFlight=null});
 if(servicesCache.length&&age<1200000){catalogFlight.catch(()=>{});return servicesCache;}
 return catalogFlight;
}
// Geographic order uses supplier targeting labels, not delivery/refill claims.
// Explicit lower-priority targeting wins for mixed USA/country listings.
const geographyRank=x=>{
 const label=[x.name,x.category,x.platform,x.country,x.region,x.location,x.geo,x.audience,x.target].map(v=>String(v||"")).join(" ").normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
 const last=/\b(?:canada|canadian|brazil|brazilian|argentina|argentinian|chile|colombia|peru|china|chinese|japan|japanese|philippines|filipino|thailand|thai|nigeria|nigerian|egypt|egyptian|saudi arabia|saudi|singapore|singaporean|nepal|nepali|sri lanka|sri lankan|russia|russian|turkey|turkiye|turkish|uk|u\.k|united kingdom|british|ireland|irish|bangladesh|bangladeshi|kenya|kenyan|germany|german|india|indian|france|french|spain|spanish|italy|italian|belgium|belgian|czech republic|czechia|czech|denmark|danish|greece|greek|malaysia|malaysian|mexico|mexican|morocco|moroccan|pakistan|pakistani|poland|polish|portugal|portuguese|south africa|south african|south korea|south korean|sweden|swedish|ukraine|ukrainian|uae|u\.a\.e|united arab emirates|emirati|vietnam|vietnamese|australia|australian|indonesia|indonesian)\b|🇹🇷|🇬🇧|🇮🇪|🇧🇩|🇰🇪|🇩🇪|🇮🇳|🇫🇷|🇪🇸|🇮🇹|🇧🇪|🇨🇿|🇩🇰|🇬🇷|🇲🇾|🇲🇽|🇲🇦|🇵🇰|🇵🇱|🇵🇹|🇿🇦|🇰🇷|🇸🇪|🇺🇦|🇦🇪|🇻🇳|🇦🇺|🇮🇩/i;
 if(last.test(label)||/\b(?:non[- ]?us|non[- ]?usa)\b/i.test(label)||/\p{Regional_Indicator}{2}/u.test(label.replaceAll("🇺🇸","")))return 2;
 return /\b(?:usa|united states(?: of america)?|american|us)\b|u\.s\.a?\.|🇺🇸/i.test(label)?0:1;
};
const platformRank=x=>{const z=String(x.name||"")+" "+String(x.category||"");return /instagram|(?:^|[^a-z])ig(?:[^a-z]|$)/i.test(z)?0:/tik[\s-]*tok/i.test(z)?1:/youtube|\byt\b/i.test(z)?2:/facebook|\bfb\b/i.test(z)?3:/spotify/i.test(z)?4:5};
// Standardize follower destinations at the payment boundary: the customer may
// submit @username or a profile link, while SMMGLOB always receives a public URL.
const followerPlatformForService=service=>{
 const label=[service?.name,service?.category].map(v=>String(v||"")).join(" ").toLowerCase();
 if(!/\bfollow(?:er)?s?\b/.test(label))return "";
 if(/instagram|(?:^|[^a-z])ig(?:[^a-z]|$)/.test(label))return "instagram";
 if(/tik[\s._-]*tok/.test(label))return "tiktok";
 return "";
};
const canonicalFollowerDestination=(rawValue,platform)=>{
 const raw=String(rawValue||"").trim();
 if(!raw||!["instagram","tiktok"].includes(platform))return null;
 const input=/^(?:www\.)?(?:instagram\.com|tiktok\.com)\//i.test(raw)?"https://"+raw:raw;
 let user=input.replace(/^@/,"");
 if(/^https?:\/\//i.test(input)){
  let parsed;try{parsed=new URL(input)}catch{return null}
  if(parsed.protocol!=="https:"||parsed.username||parsed.password)return null;
  const host=parsed.hostname.toLowerCase().replace(/^www\./,"");
  if(host!==(platform==="instagram"?"instagram.com":"tiktok.com"))return null;
  const matched=platform==="instagram"?parsed.pathname.match(/^\/([A-Za-z0-9._]+)\/?$/):parsed.pathname.match(/^\/@([A-Za-z0-9._]+)\/?$/);
  if(!matched)return null; // A post, reel or video URL is not a Followers destination.
  user=matched[1];
 }
 const valid=platform==="instagram"?/^[A-Za-z0-9._]{1,30}$/.test(user):/^[A-Za-z0-9._]{2,24}$/.test(user);
 if(!valid)return null;
 return platform==="instagram"?"https://www.instagram.com/"+user+"/":"https://www.tiktok.com/@"+user;
};
const followerRank=x=>platformRank(x)<2&&/\bfollowers?\b/i.test([x.name,x.category].join(" "))?0:1;
const platformName=x=>["Instagram","TikTok","YouTube","Facebook","Spotify","Other"][platformRank(x)];
function shape(x){const first=servicePurchaseMinimum(x,retailPer1000(x));return {id:String(x.service),name:String(x.name||"Service"),category:String(x.category||"Other"),type:String(x.type||"Default"),min:first?.quantity??Number(x.min),supplierMin:Number(x.min),max:Number(x.max),unitStep:Number(x.quantity_step??x.quantityStep??x.step??x.increment??1),startingAmountCents:first?.amountCents??null,pricingReview:!first,per1000:retailPer1000(x),refill:hasRefill(x),noDrop:hasNoDrop(x),purchasable:process.env.VERCEL_ENV!=="production"&&/^default$/i.test(String(x.type||"Default"))&&!!first};}
export async function GET(req){
 const op=name(req),flags=conf(),p=new URL(req.url).searchParams;
 if(!["config","health","smmservices","track"].includes(op))return send({error:"Unknown route"},404);
 if(op==="config")return send({ready:flags.database&&flags.supplier&&flags.payment,publicKey:publicCollectKey()||null});
 if(op==="health"){let database=false;if(flags.database)try{await db().query("select 1",[]);database=true}catch{}const gatewayMode=selectedGatewayMode();const gatewayConfigured=gatewayMode==="TEST"?!!(process.env.NMI_TEST_SECURITY_KEY&&process.env.NMI_TEST_GATEWAY_URL):!!process.env.NMI_SECURITY_KEY;return send({service:"litix-v2",database,supplierConfigured:flags.supplier,paykingsConfigured:flags.payment,orderEmailConfigured:notificationsConfigured(),gatewayMode,testGatewayConfigured:gatewayMode==="TEST"?gatewayConfigured:undefined,liveTransactionVerified:false,ready:database&&flags.supplier&&flags.payment},database?200:503)}
 if(op==="smmservices"){
  // Deprecated legacy API. The public catalog is /api/catalog/v1, Boostero only.
  return send({error:"Retired catalog disabled. Use the verified public catalog.",items:[],total:0},410);
 }

 if(op==="track"){
  const id=bounded(p.get("id"),80),secret=bounded(p.get("token"),150);
  if(!publicOrderId(id)||secret.length<25||secret.length>150)return send({error:"Invalid private tracking link"},400);
  let rows,sql;
  try{sql=db();rows=await sql.query("select id,service_name,quantity,amount_cents,payment_state,fulfillment_state,supplier_order_id,last_supplier_status from litix_v2_orders where id=$1 and tracking_token_hash=$2",[id,hash(secret)])}
  catch{return send({error:"Tracking database temporarily unavailable"},503)}
  if(!rows.length)return send({error:"Order not found"},404);
  const x=rows[0],refresh=await refreshSupplierOrder(sql,x);
  return send({order:publicOrder(x,refresh)});
 }
}
async function resendPaidOrderConfirmation(req){
 if(!notificationsConfigured())return send({error:"Email sending is temporarily unavailable"},503);
 let payload;
 try{payload=await req.json()}catch{return send({error:"Invalid request"},400)}
 const id=bounded(payload?.orderId,80),token=bounded(payload?.token,150);
 if(!/^ltx2_[a-f0-9-]{36}$/.test(id)||token.length<25)return send({error:"Invalid private tracking link"},400);
 let rows;
 try{rows=await db().query("select id,email,quantity,amount_cents,service_name,fulfillment_state,payment_state from litix_v2_orders where id=$1 and tracking_token_hash=$2",[id,hash(token)])}
 catch{return send({error:"Tracking is temporarily unavailable"},503)}
 const order=rows?.[0];
 if(!order||order.payment_state!=="paid")return send({error:"No paid order found for this tracking link"},404);
 after(()=>sendOrderEmails({orderId:id,secret:token,email:String(order.email),amountCents:Number(order.amount_cents),quantity:Number(order.quantity),serviceName:String(order.service_name),fulfillment:String(order.fulfillment_state),notifyOwner:false}).catch(e=>console.error("Litix manual resend failed",{orderId:id,error:String(e?.message||"email error").slice(0,100)})));
 return send({queued:true,message:"Confirmation and tracking email request accepted"},202);
}

async function lookupOrderByEmail(req){
 let raw;
 try{raw=await req.text();if(raw.length>1100)throw Error("oversized")}catch{return send({error:"Invalid request"},400)}
 let data;try{data=JSON.parse(raw)}catch{return send({error:"Invalid request"},400)}
 const id=bounded(data?.orderId,80),email=bounded(data?.email,254).toLowerCase();
 if(!publicOrderId(id)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send({error:"Enter the order number and checkout email."},400);
 let rows,sql;
 try{sql=db();rows=await sql.query("select id,service_name,quantity,amount_cents,payment_state,fulfillment_state,supplier_order_id,last_supplier_status from litix_v2_orders where id=$1 and lower(email)=$2 limit 1",[id,email])}
 catch{return send({error:"Order lookup is temporarily unavailable"},503)}
 if(!rows.length)return send({error:"No matching order found. Check the number and email used at checkout."},404);
 const x=rows[0],refresh=await refreshSupplierOrder(sql,x);
 return send({order:publicOrder(x,refresh)});
}
export async function POST(req){
 if(name(req)==="lookup-order")return lookupOrderByEmail(req);
 if(name(req)==="resend-confirmation")return resendPaidOrderConfirmation(req);
 if(name(req)!=="checkout")return send({error:"Unknown action"},404);
 // Litix Global 2026-10-28: Boostero is the ONLY approved supplier for NEW
 // production purchases. This legacy action is retained strictly for past
 // SMMGLOB order lookup, reconciliation and optional nonproduction tests.
 // Reject before reading card data, opening the DB, or calling the gateway.
 return send({error:"Retired supplier checkout is disabled. Choose an approved Boostero service. No payment was attempted."},409);
 const flags=conf();if(!flags.database||!flags.supplier||!flags.payment)return send({error:"Secure checkout is temporarily unavailable"},503);
 const gatewayMode=selectedGatewayMode();
 // TEST mode is fail-closed: never fall back to production credentials or pretend a transaction was verified.
 const gatewayKey=gatewayMode==="TEST"?process.env.NMI_TEST_SECURITY_KEY:process.env.NMI_SECURITY_KEY;
 const gatewayUrl=gatewayMode==="TEST"?process.env.NMI_TEST_GATEWAY_URL:"https://paykings.transactiongateway.com/api/transact.php";
 if(!gatewayKey||!gatewayUrl){return send({error:gatewayMode==="TEST"?"Sandbox checkout needs NMI_TEST_SECURITY_KEY and NMI_TEST_GATEWAY_URL configured in Vercel. No charge was submitted.":"Secure checkout is temporarily unavailable"},503)}
 let parsedGateway;try{parsedGateway=new URL(gatewayUrl)}catch{return send({error:"Payment gateway configuration is invalid"},503)}
 if(parsedGateway.protocol!=="https:"||(gatewayMode==="TEST"&&parsedGateway.hostname==="paykings.transactiongateway.com"))return send({error:"Test mode requires a dedicated HTTPS sandbox gateway URL. No charge was submitted."},503);
 let x;try{x=await req.json()}catch{return send({error:"Invalid JSON"},400)}
 const id=bounded(x.serviceId,32),qty=Number(x.quantity),email=bounded(x.email,250).toLowerCase(),link=bounded(x.link,1200),token=bounded(x.paymentToken,500),idem=bounded(x.idempotencyKey,36);
 if(!/^[0-9]+$/.test(id)||!Number.isSafeInteger(qty)||qty<1||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!link||token.length<10||!/^[a-f0-9-]{36}$/.test(idem))return send({error:"Invalid service, quantity, public URL, email or payment information"},400);
 let service;try{service=(await refreshServices(false)).find(s=>String(s.service)===id)}catch{return send({error:"Litix prices unavailable; no charge submitted"},503)}
 if(!service||!/^default$/i.test(String(service.type||"Default"))||qty<Number(service.min)||qty>Number(service.max))return send({error:"This service needs additional order information or a different quantity"},422);
 if(!legacyPublicServiceAllowed(service))return send({error:"This Instagram/TikTok service is temporarily unavailable. Choose a verified Boostero service instead; no payment attempted."},409);
 const serviceMinimum=minimumPurchaseQuantity(service,retailPer1000(service));
 const supplierStep=Number(service.quantity_step??service.quantityStep??service.step??service.increment??1);
 if(serviceMinimum===null||qty<serviceMinimum||!Number.isSafeInteger(supplierStep)||supplierStep<1||(qty-Number(service.min))%supplierStep!==0)return send({error:"Minimum $5 purchase not met at a supplier-permitted quantity. Choose an eligible quantity; no payment was submitted."},422);
 const followerPlatform=followerPlatformForService(service);
 let destination=link;
 if(followerPlatform){
  destination=canonicalFollowerDestination(link,followerPlatform);
  if(!destination)return send({error:"Enter a valid public "+(followerPlatform==="instagram"?"Instagram":"TikTok")+" username or profile link. Post URLs cannot be used for Followers."},422);
 }else{
  let target;try{target=new URL(link)}catch{}
  if(!target||target.protocol!=="https:"||!target.hostname.includes(".")||target.username||target.password)
   return send({error:"Enter the public post or profile URL required by this service."},422);
 }
 const cents=calculateOrderCents(qty,retailPer1000(service));if(cents<500||!Number.isSafeInteger(cents)||cents>100000000)return send({error:"Minimum service purchase is $5 USD; choose a higher supported quantity."},422);
 const quote=validateCheckoutQuote({actualSupplierWholesaleUsd:Number(service.rate)*qty/1000,customerSubtotalCents:cents,displayedPer1000:retailPer1000(service),quantity:qty,service:supplierPricingInput(service)});
 if(!quote.allowed)return send({error:"Quantity cannot meet wholesale pricing requirements; no charge submitted"},422);
 if(!Number.isSafeInteger(x.expectedAmountCents)||x.expectedAmountCents!==cents)return send({error:"The price has changed. Refresh the catalog and confirm the new total before paying."},409);
 const orderId="ltx2_"+randomUUID(),secret=randomUUID()+"-"+randomUUID(),sql=db();
 const notifyPaid=(fulfillment)=>after(()=>sendOrderEmails({orderId,secret,email,amountCents:cents,quantity:qty,serviceName:String(service.name||"Social media service"),fulfillment,destination,purchaseDate:new Date().toISOString()}).catch(e=>console.error("Litix email task failed",{orderId,error:String(e?.message||"send error").slice(0,100)})));
 try{const rows=await sql.query("insert into litix_v2_orders(id,email,service_id,service_name,category,destination,quantity,amount_cents,supplier_cost_cents,idempotency_key,tracking_token_hash,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) on conflict(idempotency_key) do nothing returning id",[orderId,email,id,String(service.name),String(service.category||"Other"),destination,qty,cents,Math.ceil(Number(service.rate)*qty/10),idem,hash(secret),JSON.stringify({refill:!!service.refill})]);if(!rows.length)return send({error:"Payment already submitted; do not retry the same checkout"},409);await sql.query("update litix_v2_orders set payment_state='processing',payment_attempted_at=now() where id=$1",[orderId])}catch{return send({error:"Database unavailable; no charge submitted"},503)}
 let payment;try{const r=await fetch(gatewayUrl,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({security_key:gatewayKey,type:"sale",payment_token:token,amount:(cents/100).toFixed(2),orderid:orderId,email}),signal:AbortSignal.timeout(18000),cache:"no-store"});if(!r.ok)throw Error("Payment gateway request failed");payment=Object.fromEntries(new URLSearchParams(await r.text()))}catch{await sql.query("update litix_v2_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});return send({orderId,secret,payment:"review",message:"Payment outcome is uncertain; do not retry or place a second order"},202)}
 if(String(payment.response)!=="1"){await sql.query("update litix_v2_orders set payment_state='declined' where id=$1",[orderId]).catch(()=>{});return send({error:"Payment declined: "+String(payment.responsetext||"Please contact your card issuer").slice(0,100)},402)}
 const transactionId=String(payment.transactionid||"").trim();if(!transactionId){await sql.query("update litix_v2_orders set payment_state='review' where id=$1",[orderId]).catch(()=>{});return send({orderId,secret,payment:"review",message:"Gateway reported approval without a transaction ID. Payment requires reconciliation; do not retry or place a second order."},202)}
 try{await sql.query("update litix_v2_orders set payment_state='paid',payment_transaction_id=$2 where id=$1",[orderId,transactionId]);await sql.query("update litix_v2_orders set fulfillment_state='dispatching',supplier_attempted_at=now() where id=$1 and supplier_attempted_at is null",[orderId])}catch{return send({orderId,secret,payment:"paid",fulfillment:"review",message:"Paid; supplier reconciliation required"},202)}
 try{const supplierResult=await smm("add",{service:id,link:destination,quantity:String(qty)});if(!supplierResult?.order)throw Error("No supplier order ID");await sql.query("update litix_v2_orders set supplier_order_id=$2,fulfillment_state='submitted',last_supplier_status=$3::jsonb where id=$1",[orderId,String(supplierResult.order),JSON.stringify(supplierResult)]);notifyPaid("submitted");return send({orderId,secret,payment:"paid",fulfillment:"submitted",message:"Payment approved and supplier order submitted"})}
 catch{await sql.query("update litix_v2_orders set fulfillment_state='manual_review' where id=$1",[orderId]).catch(()=>{});notifyPaid("manual_review");return send({orderId,secret,payment:"paid",fulfillment:"manual_review",message:"Payment approved, but supplier outcome requires review. Do not reorder."},202)}
}
