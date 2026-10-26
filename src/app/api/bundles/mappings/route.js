import {bundleDB,response,sameOrigin,safeEquals} from "../../../../lib/bundleOrders.mjs";
import {BUNDLE_KINDS} from "../../../../lib/growthBundles.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=40;
const authorized=req=>{
 const secret=process.env.LITIX_BUNDLES_ADMIN_TOKEN,token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 return !!secret&&secret.length>=32&&token.length>=32&&safeEquals(secret,token);
};
async function services(){
 const key=process.env.SMMGLOB_API_KEY;
 if(!key)return null;
 const r=await fetch("https://smmglob.com/api/v2",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({key,action:"services"}),cache:"no-store",signal:AbortSignal.timeout(14000)});
 if(!r.ok)throw Error("SUPPLIER_UNAVAILABLE");
 const json=await r.json();
 if(!Array.isArray(json))throw Error("SUPPLIER_FORMAT_INVALID");
 return json;
}
const kindMatches={
 Likes:/\blikes?\b/i,Views:/\bviews?\b/i,Impressions:/\b(impressions?|reach)\b/i,
 Shares:/\bshares?\b/i,Saves:/\b(saves?|bookmarks?)\b/i,Reposts:/\breposts?\b/i
};
export async function GET(req){
 if(!authorized(req))return response({error:"Unauthorized"},401);
 try{
  const sql=bundleDB(),maps=await sql.query("select platform,kind,service_id,min_qty,max_qty,refill_days,provider_rate_usd,verified_at from litix_growth_bundle_supplier_mappings order by platform,kind");
  return response({mappings:maps});
 }catch{return response({error:"Bundle mappings unavailable"},503);}
}
export async function POST(req){
 if(!authorized(req))return response({error:"Unauthorized"},401);
 if(!sameOrigin(req))return response({error:"Invalid origin"},403);
 let data;try{data=await req.json()}catch{return response({error:"Invalid JSON"},400)}
 const platform=String(data?.platform||""),kind=String(data?.kind||""),id=String(data?.serviceId||"");
 if(!["Instagram","TikTok"].includes(platform)||!BUNDLE_KINDS.includes(kind)||!/^\d{1,15}$/.test(id))return response({error:"Invalid verified supplier mapping"},422);
 let service;
 try{const list=await services();if(!list)return response({error:"SMMGLOB production API key not configured"},503);service=list.find(s=>String(s.service)===id);}
 catch{return response({error:"SMMGLOB service catalog unavailable"},503)}
 if(!service)return response({error:"Service ID not found in connected SMMGLOB catalog"},404);
 // Do not treat supplier account-currency rates as USD without provider confirmation.
 try{
  const bal=await fetch("https://smmglob.com/api/v2",{method:"POST",
   headers:{"content-type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({key:process.env.SMMGLOB_API_KEY,action:"balance"}),
   cache:"no-store",signal:AbortSignal.timeout(9000)});
  const info=bal.ok?await bal.json():null;
  if(String(info?.currency||"").toUpperCase()!=="USD")
   return response({error:"Supplier account currency is not verified as USD; cannot approve this wholesale rate"},409);
 }catch{return response({error:"Supplier currency verification unavailable"},503);}
 const name=String(service.name||""),category=String(service.category||"");
 const text=(name+" "+category),rate=Number(service.rate),min=Number(service.min),max=Number(service.max);
 if(!new RegExp(platform,"i").test(text)||!kindMatches[kind].test(name)||/dislike|comment.?likes?|mixed|multi.?service|package|bundle/i.test(name)||
  !Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<1||max<min||
  !Number.isFinite(rate)||rate<=0)return response({error:"Supplier service is not an exact supported "+platform+" "+kind+" route"},409);
 const refills=name.match(/\b(?:R|refill[ :_-]*)(\d{1,3})\b/i),refillDays=service.refill&&refills?Number(refills[1]):null;
 try{
  const sql=bundleDB();
  await sql.query("insert into litix_growth_bundle_supplier_mappings(platform,kind,service_id,provider_rate_usd,min_qty,max_qty,refill_days,verified_at) values($1,$2,$3,$4,$5,$6,$7,now()) on conflict(platform,kind) do update set service_id=excluded.service_id,provider_rate_usd=excluded.provider_rate_usd,min_qty=excluded.min_qty,max_qty=excluded.max_qty,refill_days=excluded.refill_days,verified_at=now()",
   [platform,kind,id,rate,min,max,refillDays]);
  return response({ok:true,platform,kind,serviceId:id,min,max,rateUsdPerThousand:rate,refillDays});
 }catch{return response({error:"Could not save verified mapping"},503);}
}
