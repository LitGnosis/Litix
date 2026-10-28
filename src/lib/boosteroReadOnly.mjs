/**
 * Preview-only, read-only SMM-panel v2 client for Boostero.
 * BOOSTERO_API_KEY is never accepted from callers or logged.
 * This module is NOT imported by the storefront, checkout, or supplier dispatch.
 */
const actions=new Set(["balance","services"]);
const host="boostero.com";
function endpoint(){
 const value=process.env.BOOSTERO_API_URL||"";
 let url;
 try{url=new URL(value)}catch{throw new Error("boostero_url_unconfigured")}
 if(url.protocol!=="https:"||url.hostname!==host||url.pathname.replace(/\/+$/,"")!=="/api/v2"||
    url.username||url.password||url.search||url.hash||url.port)
  throw new Error("boostero_url_not_allowlisted");
 return url.href;
}
function errorClass(raw){
 const msg=String(raw||"").slice(0,150);
 return /\b(key|unauthorized|invalid|auth|access.denied)\b/i.test(msg)?"authentication_rejected":"supplier_reported_error";
}
export async function boosteroReadOnly(action,{fetcher=fetch}={}){
 if(!actions.has(action))throw new Error("boostero_action_forbidden");
 if(process.env.VERCEL_ENV!=="preview")throw new Error("boostero_preview_only");
 const key=process.env.BOOSTERO_API_KEY;
 if(!key||typeof key!=="string")throw new Error("boostero_key_unconfigured");
 const url=endpoint();
 let response;
 try{
  response=await fetcher(url,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({key,action}).toString(),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
 }catch{throw new Error("boostero_network_error");}
 if(!response.ok)throw new Error("boostero_http_"+response.status);
 let json;
 try{json=await response.json()}catch{throw new Error("boostero_non_json_response");}
 if(json&&typeof json==="object"&&!Array.isArray(json)&&json.error){
  throw new Error("boostero_"+errorClass(json.error));
 }
 if(action==="services"&&!Array.isArray(json))throw new Error("boostero_services_invalid_shape");
 if(action==="balance"&&(!json||Array.isArray(json)||!Object.hasOwn(json,"balance")))
  throw new Error("boostero_balance_invalid_shape");
 return json;
}
export function boosteroCompatibleServices(input){
 if(!Array.isArray(input))throw new Error("boostero_services_invalid_shape");
 return input.filter(x=>{
  const label=[x?.name,x?.category].map(z=>String(z||"")).join(" ");
  const title=String(x?.name||"");
  const followers=/\bfollowers?\b/i.test(title);
  const ordinaryLikes=/\blikes?\b/i.test(title)&&!/(?:story|comment|livestream|live stream|live|battle|poll|repl(?:y|ies)|followers?)/i.test(title);
  const platform=/(instagram|\bIG\b|tiktok|tik[\s-]*tok)/i.test(label);
  const standard=/^default$/i.test(String(x?.type||"Default"));
  return platform&&standard&&(followers||ordinaryLikes);
 }).map(x=>{
  const label=[x.name,x.category].map(v=>String(v||"")).join(" ");
  const platform=/tiktok|tik[\s-]*tok/i.test(label)?"TikTok":"Instagram";
  const kind=/\bfollowers?\b/i.test(String(x.name||""))?"followers":"likes";
  const min=Number(x.min),max=Number(x.max),rate=Number(x.rate);
  const title=String(x.name||"");
  const desc=[title,x.description,x.desc,x.category,x.refill_days,x.refillDays].map(v=>String(v||"")).join(" ");
  // An SMM panel may advertise manual refills while "refill:false" means
  // the supplier API refill button is unavailable. Do not conflate these.
  const explicitNoRefill=/\b(?:no|without|non)[ -]?refill\b/i.test(title);
  const apiRefillEligible=x.refill===true||x.refillable===true||String(x.refill)==="1";
  const advertisedRefill=/\brefill\b/i.test(title)&&!explicitNoRefill;
  const refillClaim=apiRefillEligible||advertisedRefill;
  const durations=[...desc.matchAll(/\b(\d{1,3})\s*(?:days?|d)\b/gi)].map(x=>Number(x[1])).filter(Number.isFinite);
  const lifetime=/\blifetime\b|\blife\s*time\b/i.test(desc);
  const longest=durations.length?Math.max(...durations):null;
  const thirtyPlus=refillClaim&&(lifetime||(longest!==null&&longest>=30));
  const refillMethod=/\bmanual refill\b/i.test(title)?"manual advertised":apiRefillEligible?"API refill supported":advertisedRefill?"advertised, mechanism unverified":"not advertised";
  return {id:String(x.service??x.id??"").slice(0,30),platform,kind,
   name:String(x.name||"").slice(0,155),category:String(x.category||"").slice(0,100),
   wholesalePer1000USD:Number.isFinite(rate)&&rate>0?rate:null,
   min:Number.isSafeInteger(min)&&min>=0?min:null,
   max:Number.isSafeInteger(max)&&max>=0?max:null,
   refillClaim,refillDays:lifetime?"lifetime":longest,refill30Plus:thirtyPlus,
   apiRefillEligible,refillMethod,refillEvidence:refillClaim?"advertised in provider listing; fulfillment not tested":"not advertised"};
 }).filter(x=>/^\d{1,12}$/.test(x.id)&&x.wholesalePer1000USD!==null&&x.min>=1&&x.max!==null&&x.max>=x.min);
}
export const boosteroFollowers=input=>boosteroCompatibleServices(input).filter(x=>x.kind==="followers");

/**
 * Production operations are enabled ONLY after a separately authorized release.
 * This does not register a public route or modify any current SMMGLOB code.
 * Supplier add requests are never retried on network/timeout uncertainty.
 */
export async function boosteroProduction(action,parameters={},options={}){
 const allowed=new Set(["balance","services","add","status","refill"]);
 if(!allowed.has(action))throw Error("boostero_action_forbidden");
 if(process.env.VERCEL_ENV!=="production"||process.env.LITIX_BOOSTERO_ENABLED!=="true")
  throw Error("boostero_production_disabled");
 if(!process.env.BOOSTERO_API_KEY)throw Error("boostero_key_unconfigured");
 let params={};
 if(action==="add"){
  const id=String(parameters.service||""),quantity=Number(parameters.quantity),link=String(parameters.link||"");
  if(options.claimed!==true||!/^\d{1,12}$/.test(id)||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000||
     !(/^https:\/\/www\.(instagram\.com\/[a-zA-Z0-9._]{1,30}\/|tiktok\.com\/@[A-Za-z0-9._]{2,24}\/)$/.test(link)||
     /^https:\/\/www\.instagram\.com\/(?:p|reel)\/[a-zA-Z0-9_-]{5,32}\/$/.test(link)||
     /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._]{2,24}\/video\/[0-9]{10,30}$/.test(link)))
   throw Error("boostero_add_not_authorized");
  params={service:id,quantity:String(quantity),link};
 }else if(action==="status"||action==="refill"){
  const order=String(parameters.order||"");
  if(!/^\d{1,24}$/.test(order))throw Error("boostero_supplier_id_invalid");
  if(action==="refill"&&options.adminApproved!==true)throw Error("boostero_refill_needs_approval");
  params={order};
 }
 let response;
 try{
  response=await (options.fetcher||fetch)(endpoint(),{
   method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({key:process.env.BOOSTERO_API_KEY,action,...params}).toString(),
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(action==="services"?20000:15000)
  });
 }catch{throw Error("boostero_network_unknown_outcome");}
 if(!response.ok)throw Error("boostero_http_"+response.status+(action==="add"?"_unknown_outcome":""));
 let data;
 try{data=await response.json()}catch{throw Error("boostero_invalid_json"+(action==="add"?"_unknown_outcome":""))}
 if(data&&typeof data==="object"&&!Array.isArray(data)&&data.error)
  throw Error("boostero_provider_rejected");
 if(action==="services"&&!Array.isArray(data))throw Error("boostero_services_invalid_shape");
 if(action==="balance"&&(!data||Array.isArray(data)||!Object.hasOwn(data,"balance")))
  throw Error("boostero_balance_invalid_shape");
 if(action==="add"&&(!data||!/^\d{1,24}$/.test(String(data.order||""))))
  throw Error("boostero_add_unconfirmed_outcome");
 return data;
}
