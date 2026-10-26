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
  return await sql.query("select platform,kind,service_id,min_qty,max_qty,refill_days from litix_growth_bundle_supplier_mappings where verified_at is not null");
 }catch{return []}
}
export async function bundleCheckoutReady(){
 if(!bundlePaymentPrerequisites())return false;
 const maps=await verifiedMappings();
 return ["Instagram","TikTok"].every(p=>BUNDLE_KINDS.every(k=>maps.some(m=>m.platform===p&&m.kind===k&&/^\d+$/.test(String(m.service_id))&&Number(m.min_qty)>0&&Number(m.max_qty)>=Number(m.min_qty))));
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
