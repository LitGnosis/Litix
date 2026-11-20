// Owner-only SMM Panel v2 adapter. No public catalog or checkout imports.
const SOURCES=Object.freeze({
 boostero:{url:"https://boostero.com/api/v2",key:"BOOSTERO_API_KEY",enabled:"LITIX_OWNER_BOOSTERO_ENABLED"},
 smmglob:{url:"https://smmglob.com/api/v2",key:"LITIX_OWNER_SMMGLOB_API_KEY",enabled:"LITIX_OWNER_SMMGLOB_ENABLED"}
});
export const sources=Object.freeze(Object.keys(SOURCES));
export function supplierConfig(id){
 const x=SOURCES[id];
 if(!x)throw Error("invalid_owner_supplier");
 const key=String(process.env[x.key]||"");
 if(process.env[x.enabled]!=="true"||key.length<12)throw Error("owner_supplier_not_connected");
 return {...x,key};
}
export async function supplierCall(id,action,args={},permit={approved:false}){
 const x=supplierConfig(id);
 if(!["services","balance","status","add"].includes(action))throw Error("owner_supplier_action_denied");
 if(action==="add"&&(permit.approved!==true||process.env.LITIX_OWNER_PURCHASES_ENABLED!=="true"||
   process.env.VERCEL_ENV!=="production"))throw Error("owner_purchases_disabled");
 let fields={};
 if(action==="add"){
  if(!/^\d{1,12}$/.test(String(args.service||""))||!Number.isSafeInteger(args.quantity)||
    args.quantity<1||args.quantity>1000000||!/^https:\/\//.test(String(args.link||"")))throw Error("owner_add_invalid");
  fields={service:String(args.service),quantity:String(args.quantity),link:String(args.link)};
 }else if(action==="status"){
  if(!/^\d{1,24}$/.test(String(args.order||"")))throw Error("owner_status_invalid");
  fields={order:String(args.order)};
 }
 let r;
 try{
  r=await fetch(x.url,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({key:x.key,action,...fields}),redirect:"error",cache:"no-store",
   signal:AbortSignal.timeout(action==="services"?16000:12000)});
 }catch{throw Error(action==="add"?"owner_supplier_unknown_outcome":"owner_supplier_network_unavailable")}
 if(!r.ok)throw Error(action==="add"?"owner_supplier_unknown_outcome":"owner_supplier_http_error");
 let data;try{data=await r.json()}catch{throw Error(action==="add"?"owner_supplier_unknown_outcome":"owner_supplier_json_invalid")}
 if(data?.error)throw Error(action==="add"?"owner_supplier_rejected":"owner_supplier_reported_error");
 if(action==="services"&&!Array.isArray(data))throw Error("owner_catalog_invalid");
 if(action==="balance"&&(!data||typeof data!=="object"||Array.isArray(data)||
    !Number.isFinite(Number(data.balance))||Number(data.balance)<0))throw Error("owner_balance_invalid");
 if(action==="add"&&(!data||!/^\d{1,24}$/.test(String(data.order||""))))throw Error("owner_supplier_unknown_outcome");
 return data;
}
export function parseWallet(v){
 // Don't convert currencies or compare incompatible wallets.
 if(String(v?.currency||"").toUpperCase()!=="USD")throw Error("owner_currency_not_verified_usd");
 const n=Number(v.balance);
 if(!Number.isFinite(n)||n<0)throw Error("owner_balance_invalid");
 return {currency:"USD",balanceCents:Math.floor((n+1e-8)*100)};
}
const serviceKinds=["followers","likes","views","comments","subscribers","shares","saves","retweets","plays"];
export function parseService(s,supplier){
 if(String(s?.type||"").toLowerCase()!=="default"||!/^\d{1,12}$/.test(String(s.service||"")))return null;
 const min=Number(s.min),max=Number(s.max),step=Number(s.step||1),rate=Number(s.rate);
 if(!Number.isSafeInteger(min)||min<1||!Number.isSafeInteger(max)||max<min||
    !Number.isSafeInteger(step)||step<1||!Number.isFinite(rate)||rate<=0||rate>100000)return null;
 const name=String(s.name||"").slice(0,180),category=String(s.category||"").slice(0,110);
 const full=name+" "+category;
 const platform=(["Instagram","TikTok","YouTube","Facebook","Twitter","X","Telegram","Spotify"].find(p=>
  new RegExp(p==="X"?"\\bX\\b":p,"i").test(full)))||"Other";
 const kind=serviceKinds.find(k=>new RegExp("\\b"+k+"\\b","i").test(name))||"other";
 const refill=s.refill===true||s.refill==="1"||s.refill===1;
 const speed=(name.match(/\b(?:\d+[kKmM]?\s*\/\s*day|\d+\s*(?:hours?|days?)|instant|fast)\b/i)||[])[0]||null;
 return {supplier,id:String(s.service),name,category,platform,kind,rateUSDPer1000:rate,
  min,max,step,refillAdvertised:refill,refillDescription:refill?"API lists refill":"Not listed",
  advertisedDelivery:speed,deliveryVerified:false};
}
export const parseCatalog=(raw,id)=>raw.map(x=>parseService(x,id)).filter(Boolean);
export function costCents(item,quantity){
 if(!item||!Number.isSafeInteger(quantity)||quantity<item.min||quantity>item.max||
    ((quantity-item.min)%item.step)!==0)throw Error("owner_quantity_unavailable");
 const cents=Math.ceil(item.rateUSDPer1000*quantity/10-1e-8);
 if(!Number.isSafeInteger(cents)||cents<1||cents>100000000)throw Error("owner_wholesale_price_invalid");
 return cents;
}
export function normalizeOwnerTarget(raw,service){
 const value=String(raw||"").trim();
 const platform=String(service.platform||"").toLowerCase();
 let input=value;
 if(/^@[a-z0-9._]{1,30}$/i.test(value)&&platform==="instagram")
   input="https://www.instagram.com/"+value.slice(1)+"/";
 let u;try{u=new URL(input)}catch{throw Error("owner_target_invalid")}
 if(u.protocol!=="https:"||u.username||u.password||u.port||u.hash||input.length>700)
   throw Error("owner_target_invalid");
 const host=u.hostname.toLowerCase().replace(/^www\./,"");
 const allowed=["instagram.com","tiktok.com","youtube.com","youtu.be","facebook.com","fb.watch",
  "x.com","twitter.com","threads.net","telegram.me","t.me","spotify.com","soundcloud.com","twitch.tv"];
 if(!allowed.some(d=>host===d||host.endsWith("."+d))||!u.pathname||u.pathname==="/")
   throw Error("owner_target_invalid");
 return u.toString();
}
