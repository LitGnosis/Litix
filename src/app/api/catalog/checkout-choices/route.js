export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Old numeric service IDs are not valid for Litix-owned orders. */
export async function GET(){
 return Response.json({
  platforms:[],platform:"",kinds:[],items:[],total:0,
  directCheckoutPath:"/#checkout",
  error:"No verified first-party engagement packages are available.",
  externalSupplierApiCalls:0
 },{headers:{"cache-control":"no-store"}});
}
