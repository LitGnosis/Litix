import {createHmac} from "node:crypto";
import {boosteroProduction} from "../../../lib/boosteroReadOnly.mjs";
import {boosteroSQL,boosteroProductionReady} from "../../../lib/boosteroFulfillment.mjs";
import {litixPlatform,litixKind} from "../../../lib/litixServiceClassify.mjs";
import {canonicalPost,normalizeProfile} from "../../../lib/postPicker.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const reply=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const hmac=(text)=>createHmac("sha256",process.env.LITIX_TRIAL_HASH_SECRET).update(text).digest("hex");
function sameOrigin(req){
 try{return new URL(req.headers.get("origin")).origin===new URL(req.url).origin}catch{return false}
}
async function turnstile(token,ip){
 const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
  method:"POST",cache:"no-store",redirect:"error",
  body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:token,remoteip:ip}),
  signal:AbortSignal.timeout(8000)});
 if(!response.ok)return false;
 const body=await response.json();
 return body.success===true&&(!body.hostname||["litix.net","www.litix.net"].includes(body.hostname));
}
const serviceIdFor=(platform,kind)=>process.env[
 "LITIX_TRIAL_"+platform.toUpperCase()+"_"+kind.toUpperCase()+"_SERVICE_ID"];
export async function POST(request){
 if(process.env.LITIX_FREE_TRIAL_ENABLED!=="true"||
    !process.env.LITIX_TRIAL_HASH_SECRET||process.env.LITIX_TRIAL_HASH_SECRET.length<40||
    !process.env.TURNSTILE_SECRET_KEY||!boosteroProductionReady())
  return reply({error:"Free trial is not available"},503);
 if(!sameOrigin(request)||!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||""))
  return reply({error:"Invalid submission"},403);
 if(Number(request.headers.get("content-length")||0)>4096)return reply({error:"Submission too large"},413);
 let body;
 try{body=await request.json()}catch{return reply({error:"Invalid JSON"},400)}
 const platform=String(body?.platform||"").toLowerCase();
 const kind=String(body?.kind||"").toLowerCase();
 const handle=normalizeProfile(platform,body?.username);
 const email=String(body?.email||"").trim().toLowerCase();
 const destination=canonicalPost(platform,body?.postUrl);
 const captcha=String(body?.turnstileToken||"");
 if(!["instagram","tiktok"].includes(platform)||!["likes","views"].includes(kind)||
    !handle||!destination||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||
    captcha.length<10||captcha.length>3000)
  return reply({error:"Enter your public profile, eligible post URL, email and CAPTCHA"},422);
 // A TikTok video URL contains the profile handle; reject mismatches.
 if(platform==="tiktok"&&!destination.toLowerCase().includes("/@"+handle.toLowerCase()+"/"))
  return reply({error:"The video must belong to the selected TikTok profile"},422);
 const ip=String(request.headers.get("x-vercel-forwarded-for")||
  request.headers.get("x-forwarded-for")?.split(",")[0]||"").trim();
 if(!ip||ip.length>80)return reply({error:"Cannot verify request"},429);
 try{
  if(!await turnstile(captcha,ip))return reply({error:"CAPTCHA verification failed"},403);
 }catch{return reply({error:"CAPTCHA verification temporarily unavailable"},503)}
 const id=String(serviceIdFor(platform,kind)||"");
 if(!/^\d{1,12}$/.test(id))return reply({error:"Free trial service not configured"},503);
 let eligible=null;
 try{
  const rows=await boosteroProduction("services");
  const service=rows.find(x=>String(x?.service)===id);
  const qty=20;
  if(service&&/^default$/i.test(String(service.type||"Default"))&&
     Number(service.min)<=qty&&Number(service.max)>=qty&&
     litixPlatform(service.name,service.category).toLowerCase()===platform&&
     litixKind(service.name,service.category)===kind){
   const costUSD=Number(service.rate)*qty/1000;
   const cap=Number(process.env.LITIX_FREE_TRIAL_MAX_COST_USD||"0.30");
   if(Number.isFinite(costUSD)&&costUSD>0&&Number.isFinite(cap)&&cap>0&&cap<=1&&costUSD<=cap){
    const balance=await boosteroProduction("balance");
    if(Number(balance.balance)>=costUSD+20)eligible={service,costUSD};
   }
  }
 }catch{return reply({error:"Unable to verify free trial availability"},503)}
 if(!eligible)return reply({error:"Free trial delivery is temporarily unavailable"},503);
 let claimId;
 const sql=boosteroSQL();
 try{
  const rows=await sql.query(`SELECT public.litix_claim_free_trial($1,$2,$3,$4,$5,$6,$7,$8,$9) AS id`,[
   platform,kind,handle,email,destination,hmac(ip),hmac(email),hmac(platform+":"+handle),
   body.marketingConsent===true]);
  claimId=rows[0]?.id;
 }catch(error){
  console.error("litix_trial_claim_failed",{code:String(error?.code||"db").slice(0,24)});
  return reply({error:"Trial claim processing is unavailable"},503);
 }
 if(!claimId)return reply({error:"One trial per IP, email and social profile every 30 days. The trial cap may also have been reached."},429);
 const state=await sql.query(`UPDATE public.litix_free_trial_claims
   SET state='DISPATCHING',updated_at=now() WHERE id=$1 AND state='CLAIMED'
   RETURNING id`,[claimId]).catch(()=>[]);
 if(state.length!==1)return reply({error:"Trial queued for manual reconciliation",claimId},202);
 try{
  // Only one supplier call. An ambiguous error is never blindly retried.
  const result=await boosteroProduction("add",
   {service:id,quantity:20,link:destination},{claimed:true});
  const supplierId=String(result.order||"");
  if(!/^\d{1,24}$/.test(supplierId))throw Error("supplier_unconfirmed");
  await sql.query(`UPDATE public.litix_free_trial_claims
    SET state='SUBMITTED',supplier_order_id=$2,updated_at=now()
    WHERE id=$1 AND state='DISPATCHING'`,[claimId,supplierId]);
  return reply({claimId,status:"submitted",message:"Trial request submitted. Delivery times vary."},202);
 }catch(error){
  await sql.query(`UPDATE public.litix_free_trial_claims
    SET state='UNKNOWN_OUTCOME',error_code=$2,updated_at=now()
    WHERE id=$1 AND state='DISPATCHING'`,[claimId,"supplier_requires_reconciliation"]).catch(()=>{});
  console.error("litix_trial_dispatch_review",{claimId});
  return reply({claimId,status:"review",message:"Trial outcome needs verification. Do not submit another claim."},202);
 }
}
