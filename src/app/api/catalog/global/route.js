export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Global directory excludes unverified external engagement services. */
export async function GET(){
 return Response.json({
  brand:"Litix",items:[],total:0,allCount:0,page:1,pageSize:24,
  platforms:[],categories:[],verifiedPurchasableCount:0,
  checkoutPath:"/#checkout",currency:"USD",
  notice:"Only independently verified Litix-owned services may be purchased.",
  externalSupplierApiCalls:0
 },{headers:{"cache-control":"no-store"}});
}
