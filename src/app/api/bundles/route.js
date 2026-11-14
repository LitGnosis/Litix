export const runtime="nodejs";
export const dynamic="force-dynamic";
export const bundleDBUrl=()=>process.env.LITIX_BUNDLES_DATABASE_URL||process.env.LITIX_AUTOLIKES_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL;
export function bundlePaymentPrerequisites(){return false;}
export async function bundleCheckoutReady(){return false;}
export async function bundleBluevineReady(){return false;}
export async function GET(){
 return Response.json({
  error:"Growth Bundles have been discontinued. Individual services are available in the Litix catalog.",
  code:"BUNDLES_RETIRED",checkoutEnabled:false,bluevineEnabled:false,
  autoFulfillmentEnabled:false,packages:[],directServicesUrl:"/services"
 },{status:410,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
