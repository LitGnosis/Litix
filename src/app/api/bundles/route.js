import {neon} from "@neondatabase/serverless";
import {GROWTH_BUNDLES,BUNDLE_KINDS,configuredWhatsApp,BUNDLE_INSTRUCTIONS} from "../../../lib/growthBundles.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const bundleDBUrl=()=>process.env.LITIX_BUNDLES_DATABASE_URL||process.env.LITIX_AUTOLIKES_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL;
export function bundlePaymentPrerequisites(){
 return Boolean(process.env.VERCEL_ENV==="production"&&
  process.env.LITIX_BUNDLES_LIVE_ENABLED==="true" &&
  process.env.NMI_GATEWAY_MODE==="PRODUCTION"&&process.env.NMI_SECURITY_KEY&&
  (process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY)&&
  process.env.SMMGLOB_API_KEY&&
  (process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY)&&
  process.env.LITIX_BUNDLES_ADMIN_TOKEN&&bundleDBUrl()&&configuredWhatsApp());
}
export async function verifiedMappings(){
 if(!bundleDBUrl())return [];
 const sql=neon(bundleDBUrl());
 try{
  return await sql.query("select platform,kind,service_id,min_qty,max_qty,refill_days,provider_rate_usd from litix_growth_bundle_supplier_mappings where verified_at is not null");
 }catch{return []}
}
export async function bundleCheckoutReady(){
 if(!bundlePaymentPrerequisites())return false;
 const maps=await verifiedMappings();
 return GROWTH_BUNDLES.every(bundle=>{
  let supplierCostUsd=0;
  for(const kind of BUNDLE_KINDS){
   const m=maps.find(x=>x.platform===bundle.platform&&x.kind===kind);
   const qty=bundle.items[kind];
   if(!m||!/^\d+$/.test(String(m.service_id))||Number(m.min_qty)<1||Number(m.max_qty)<Number(m.min_qty)||
     !Number.isFinite(Number(m.provider_rate_usd))||Number(m.provider_rate_usd)<=0||
     Number(m.min_qty)>qty||Number(m.max_qty)*bundle.maxPosts<qty)return false;
   supplierCostUsd+=Number(m.provider_rate_usd)*qty/1000;
  }
  return supplierCostUsd*100<bundle.priceCents;
 });
}
export async function GET(){
 const ready=await bundleCheckoutReady();
 const phone=configuredWhatsApp();
 return Response.json({
  packages:GROWTH_BUNDLES,
  checkoutEnabled:ready,
  whatsappConfigured:Boolean(phone),
  instructions:BUNDLE_INSTRUCTIONS,
  publicKey:ready?(process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY):null
 },{headers:{"cache-control":"no-store"}});
}
