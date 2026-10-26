import {neon} from "@neondatabase/serverless";
import {GROWTH_BUNDLES,configuredWhatsApp,BUNDLE_INSTRUCTIONS} from "../../../lib/growthBundles.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const bundleDBUrl=()=>process.env.LITIX_BUNDLES_DATABASE_URL||process.env.LITIX_AUTOLIKES_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL;
export function bundlePaymentPrerequisites(){
 // A bundle is a one-time purchase personally fulfilled by the owner after WhatsApp submission.
 // SMMGLOB, supplier mappings, recurring billing, admin dashboard and Resend are NOT purchase prerequisites.
 return Boolean(process.env.VERCEL_ENV==="production"&&
  process.env.LITIX_BUNDLES_LIVE_ENABLED==="true"&&
  process.env.NMI_GATEWAY_MODE==="PRODUCTION"&&process.env.NMI_SECURITY_KEY&&
  (process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY)&&
  bundleDBUrl()&&configuredWhatsApp());
}
export async function bundleCheckoutReady(){
 if(!bundlePaymentPrerequisites())return false;
 try{
  const sql=neon(bundleDBUrl());
  const found=await sql.query("select to_regclass('public.litix_growth_bundle_orders') as orders");
  return !!found?.[0]?.orders;
 }catch{return false}
}
export async function GET(){
 const ready=await bundleCheckoutReady();
 return Response.json({
  packages:GROWTH_BUNDLES,
  checkoutEnabled:ready,
  whatsappConfigured:Boolean(configuredWhatsApp()),
  manualFulfillment:true,
  instructions:BUNDLE_INSTRUCTIONS,
  publicKey:ready?(process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY):null
 },{headers:{"cache-control":"no-store"}});
}
