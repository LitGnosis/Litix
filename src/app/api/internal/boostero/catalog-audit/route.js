import {boosteroReadOnly} from "../../../../../lib/boosteroReadOnly.mjs";
import {normalizeBoosteroCatalog} from "../../../../../lib/boosteroGlobalCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const respond=(value,status=200)=>Response.json(value,{status,headers:{
 "cache-control":"no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex"
}});
/**
 * Temporary non-sensitive audit on Vercel Preview only. The supplier key
 * remains inside Boostero's server-side client. This endpoint never writes
 * DB records, returns wholesale prices, or calls add/refill/cancel.
 */
export async function GET(){
 if(process.env.VERCEL_ENV!=="preview")return respond({error:"not_found"},404);
 try{
  const raw=await boosteroReadOnly("services");
  const {stats}=normalizeBoosteroCatalog(raw);
  return respond({supplier:"boostero",readOnly:true,source:"live_api_v2_services",...stats,
   publicEnabledInProduction:"independent_approved_allowlist"});
 }catch(error){
  const msg=String(error?.message||"").slice(0,100);
  const code=/^boostero_[a-z0-9_]+$/.test(msg)?msg:"catalog_audit_unavailable";
  return respond({error:code,readOnly:true},503);
 }
}
