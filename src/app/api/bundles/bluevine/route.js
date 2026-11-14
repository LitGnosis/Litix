// No new Bluevine bundle payment links or unpaid orders may be created.
// Historical orders and payment reconciliation records are retained.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(){
 return Response.json({
  error:"Growth Bundles are discontinued. No new payment link was created.",
  code:"BUNDLES_RETIRED",chargeAttempted:false,checkoutUrl:null
 },{status:410,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
