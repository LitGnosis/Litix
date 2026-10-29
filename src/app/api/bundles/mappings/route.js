// Historical bundle mapping records are read-only. Bundles remain manual fulfillment.
// Retired supplier lookups and legacy mapping writes are disabled permanently.
import {bundleDB,response} from "../../../../lib/bundleOrders.mjs";
export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=40;
const authorized=req=>{
 const secret=process.env.LITIX_BUNDLES_ADMIN_TOKEN;
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 return !!secret&&secret.length>=32&&token.length>=32&&
  (awaitingSafeCompare(secret,token));
};
// Preserve constant-time token comparisons used by existing owner routes.
import {safeEquals} from "../../../../lib/bundleOrders.mjs";
const awaitingSafeCompare=(a,b)=>safeEquals(a,b);
export async function GET(req){
 if(!authorized(req))return response({error:"Unauthorized"},401);
 try{
  const sql=bundleDB();
  const maps=await sql.query("select platform,kind,service_id,min_qty,max_qty,refill_days,provider_rate_usd,verified_at from litix_growth_bundle_supplier_mappings order by platform,kind");
  return response({mappings:maps,historicalOnly:true,supplierMappingWritesEnabled:false});
 }catch{return response({error:"Historical bundle mappings unavailable"},503);}
}
export async function POST(req){
 if(!authorized(req))return response({error:"Unauthorized"},401);
 return response({error:"Retired supplier mappings are closed. Existing bundles remain manual and no supplier request was made."},410);
}
