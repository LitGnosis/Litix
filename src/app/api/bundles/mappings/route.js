import {bundleDB,response,sameOrigin,safeEquals} from "../../../../lib/bundleOrders.mjs";
import {BUNDLE_KINDS} from "../../../../lib/growthBundles.mjs";
import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {chooseBundleBoosteroService} from "../../../../lib/growthBundleRouting.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=40;
const authorized=req=>{
 const secret=process.env.LITIX_BUNDLES_ADMIN_TOKEN,token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 return !!secret&&secret.length>=32&&token.length>=32&&safeEquals(secret,token);
};
// Production mappings are approved against Boostero only, never legacy suppliers.
async function services(){return boosteroProduction("services")}
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
 if(!["Instagram","TikTok"].includes(platform)||!BUNDLE_KINDS.includes(kind)||!/^\d{1,12}$/.test(id))return response({error:"Invalid verified supplier mapping"},422);
 let service;
 try{const list=await services();if(!list)return response({error:"Supplier catalog temporarily unavailable"},503);service=list.find(s=>String(s.service)===id);}
 catch{return response({error:"Supplier catalog temporarily unavailable"},503)}
 if(!service)return response({error:"Service not found in the live provider catalog"},404);
 // Only approved provider item types, exact service kinds and verified USD balances.
 let wallet;
 try{wallet=await boosteroProduction("balance")}
 catch{return response({error:"Supplier balance verification unavailable"},503)}
 if(String(wallet?.currency||"").toUpperCase()!=="USD")
  return response({error:"Supplier account currency has not been verified as USD"},409);
 const rate=Number(service.rate),min=Number(service.min),max=Number(service.max);
 if(!Number.isSafeInteger(min)||min<1||!Number.isSafeInteger(max)||max<min||
  !Number.isFinite(rate)||rate<=0||
  !chooseBundleBoosteroService([service],platform,{kind,quantity:min}))
  return response({error:"Service is not an eligible default "+platform+" "+kind+" mapping"},409);
 const refillDays=null;
 try{
  const sql=bundleDB();
  await sql.query("insert into litix_growth_bundle_supplier_mappings(platform,kind,service_id,provider_rate_usd,min_qty,max_qty,refill_days,verified_at) values($1,$2,$3,$4,$5,$6,$7,now()) on conflict(platform,kind) do update set service_id=excluded.service_id,provider_rate_usd=excluded.provider_rate_usd,min_qty=excluded.min_qty,max_qty=excluded.max_qty,refill_days=excluded.refill_days,verified_at=now()",
   [platform,kind,id,rate,min,max,refillDays]);
  return response({ok:true,platform,kind,serviceId:id,min,max,rateUsdPerThousand:rate,refillDays});
 }catch{return response({error:"Could not save verified mapping"},503);}
}
