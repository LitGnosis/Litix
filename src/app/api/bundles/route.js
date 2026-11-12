export const runtime="nodejs";
export const dynamic="force-dynamic";
// Historical bundle order tracking remains in /api/bundles/order.
// No new legacy social bundles can appear as purchasable packages.
export const bundleDBUrl=()=>process.env.LITIX_BUNDLES_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL||"";
export const bundlePaymentPrerequisites=()=>false;
export async function bundleCheckoutReady(){return false}
export async function bundleBluevineReady(){return false}
export async function GET(){
 return Response.json({packages:[],checkoutEnabled:false,bluevineEnabled:false,
  whatsappConfigured:false,manualFulfillment:false,autoFulfillmentEnabled:false,
  instructions:null,publicKey:null},
  {headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
