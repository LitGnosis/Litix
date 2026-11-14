// Disabled new Growth Bundle purchases. Historical payment and tracking
// records remain accessible through restricted reconciliation endpoints.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(){
 return Response.json({
  error:"Growth Bundles are discontinued. No payment was attempted.",
  code:"BUNDLES_RETIRED",checkoutEnabled:false,chargeAttempted:false,
  supplierApiCalled:false,directServicesUrl:"/services"
 },{status:410,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
