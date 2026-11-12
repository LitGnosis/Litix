export const runtime="nodejs";
export const dynamic="force-dynamic";
/** New prepaid likes orders require attested first-party engagement capacity. */
export async function POST(){
 return Response.json({
  error:"Automatic likes are unavailable until real owned-node delivery is verified. No card charge attempted.",
  code:"FIRST_PARTY_AUTOLIKES_UNVERIFIED",chargeAttempted:false,externalSupplierApiCalls:0
 },{status:409,headers:{"cache-control":"no-store"}});
}
