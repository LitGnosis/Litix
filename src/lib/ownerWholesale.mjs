import {boosteroFollowers} from "./boosteroReadOnly.mjs";
const api=Object.freeze({
 smmglob:{url:"https://smmglob.com/api/v2",key:"SMMGLOB_API_KEY"},
 boostero:{url:"https://boostero.com/api/v2",key:"BOOSTERO_API_KEY"}
});
const only=new Set(["services","balance","add","status"]);
export async function ownerSupplierAPI(provider,action,params={},opts={}){
 const c=api[provider];if(!c||!only.has(action))throw Error("supplier_action_denied");
 if(action==="add"&&opts.oneTimeLocked!==true)throw Error("unlocked_supplier_purchase_denied");
 if(action==="add"&&process.env.LITIX_OWNER_WHOLESALE_PURCHASES!=="true")throw Error("owner_purchases_disabled");
 const key=process.env[c.key];if(!key)throw Error(provider+"_credentials_not_configured");
 const endpoint=provider==="smmglob"?(process.env.SMMGLOB_API_URL||c.url):(process.env.BOOSTERO_API_URL||c.url);
 const url=new URL(endpoint);
 const host=new URL(c.url);
 if(url.protocol!=="https:"||![host.hostname,"www."+host.hostname].includes(url.hostname)||
    url.pathname.replace(/\/+$/,"")!=="/api/v2"||url.username||url.password||url.search||url.hash||url.port)
  throw Error("supplier_host_denied");
 const values={key,action};
 if(action==="status"){if(!/^\d{1,24}$/.test(String(params.order||"")))throw Error("invalid_supplier_order");values.order=String(params.order)}
 if(action==="add"){
  if(!/^\d{1,12}$/.test(String(params.service||""))||
    !/^\d{1,7}$/.test(String(params.quantity||""))||
    !/^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]{1,30}\/$/.test(String(params.link||"")))throw Error("invalid_supplier_order_fields");
  Object.assign(values,{service:String(params.service),quantity:String(params.quantity),link:params.link});
 }
 let response;
 try{response=await (opts.fetcher||fetch)(url,{method:"POST",cache:"no-store",redirect:"error",
  headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(values),
  signal:AbortSignal.timeout(action==="services"?18000:16000)})}
 catch{throw Error(action==="add"?"supplier_outcome_unknown":"supplier_network_unavailable")}
 if(!response.ok)throw Error(action==="add"?"supplier_outcome_unknown":"supplier_http_"+response.status);
 let json;try{json=await response.json()}catch{throw Error(action==="add"?"supplier_outcome_unknown":"supplier_invalid_response")}
 if(json?.error)throw Error("supplier_definitely_rejected");
 if(action==="services"&&!Array.isArray(json))throw Error("supplier_catalog_invalid");
 if(action==="balance"&&(!json||!Number.isFinite(Number(json.balance))))throw Error("supplier_balance_invalid");
 if(action==="add"&&!/^\d{1,24}$/.test(String(json?.order||"")))throw Error("supplier_outcome_unknown");
 return json;
}
function refillDetails(row){
 const name=String(row.name||"");
 const noRefill=/\b(?:no|without|non)[ -]?refills?\b/i.test(name);
 const manual=/\bmanual\s+refill\b/i.test(name);
 const api=row.refill===true||String(row.refill)==="1"||row.refillable===true;
 const advertised=!noRefill&&(api||/\brefills?\b/i.test(name));
 const dates=[...name.matchAll(/\b(\d{1,3})\s*(?:days?|d)\b/gi)].map(x=>Number(x[1]));
 return {refillDays:advertised?(dates.length?Math.max(...dates):/\blifetime\b/i.test(name)?365:null):null,
  refillEligible:api,refillAdvertised:advertised,refillMethod:manual?"manual advertised":api?"API refill enabled":advertised?"advertised":"not advertised"};
}
export function normalizeWholesaleRows(provider,raw){
 if(!Array.isArray(raw))throw Error("invalid_catalog");
 return raw.flatMap(row=>{
  const label=[row?.name,row?.category].map(x=>String(x||"")).join(" ");
  if(!/\binstagram\b|\bIG\b|🇺🇸\s*IG/i.test(label)||!/\bfollowers?\b/i.test(label)||/\btiktok\b/i.test(label))return [];
  const id=String(row.service??row.id??""),rate=Number(row.rate),min=Number(row.min),max=Number(row.max);
  if(!/^\d{1,12}$/.test(id)||!Number.isFinite(rate)||rate<=0||!Number.isSafeInteger(min)||min<1||
   !Number.isSafeInteger(max)||max<min)return [];
  const refill=refillDetails(row);
  const name=String(row.name||"").slice(0,180);
  const speed=name.match(/(?:\d+(?:\.\d+)?\s*[kKmM]?\s*(?:\/|per)\s*(?:day|hour)|instant|fast|slow|start\s*\d+[ -]?\d*\s*(?:min|hr|hour))/i)?.[0]||"Not specified";
  const lowDrop=/\b(low[ -]?drop|non[ -]?drop|no[ -]?drop)\b/i.test(name);
  return [{provider,id,name,category:String(row.category||"").slice(0,80),pricePer1000:rate,min,max,
   advertisedSpeed:speed,lowDropClaim:lowDrop,...refill}];
 }).sort((a,b)=>a.pricePer1000-b.pricePer1000||a.provider.localeCompare(b.provider));
}
export async function ownerWholesaleCatalog({fetcher}={}){
 const settled=await Promise.allSettled(["smmglob","boostero"].map(async provider=>{
  const raw=await ownerSupplierAPI(provider,"services",{},fetcher?{fetcher}:{});return normalizeWholesaleRows(provider,raw)
 }));
 return {services:settled.flatMap(x=>x.status==="fulfilled"?x.value:[]).sort((a,b)=>a.pricePer1000-b.pricePer1000),
  providers:["smmglob","boostero"].map((p,i)=>({name:p,status:settled[i].status==="fulfilled"?"ready":"unavailable"}))};
}
export function wholesaleQuote(row,quantity){
 const q=Number(quantity);if(!row||!Number.isSafeInteger(q)||q<row.min||q>row.max||q>1000000)throw Error("supplier_quantity_invalid");
 const cost=row.pricePer1000*q/1000;
 if(!Number.isFinite(cost)||cost<=0||cost>100000)throw Error("supplier_price_invalid");
 return {quantity:q,costCents:Math.ceil(cost*100-1e-8),estimatedSupplierUSD:cost,
  ratePer1000:row.pricePer1000,provider:row.provider,serviceId:row.id};
}
export function ownerProfile(value){
 const t=String(value||"").trim();
 let u=t.replace(/^@/,"");
 if(/^https?:\/\//i.test(t)){
  let url;try{url=new URL(t)}catch{return null}
  if(url.protocol!=="https:"||!["instagram.com","www.instagram.com"].includes(url.hostname)||
     url.search||url.hash||url.username||url.password||url.port)return null;
  u=url.pathname.replace(/^\/|\/$/g,"");
 }
 return /^[a-z0-9._]{1,30}$/i.test(u)&&!["p","reel","stories","explore","api"].includes(u.toLowerCase())?
  "https://www.instagram.com/"+u+"/":null;
}
