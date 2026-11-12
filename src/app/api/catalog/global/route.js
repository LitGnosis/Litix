export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 return Response.json({
  brand:"Litix",items:[],total:0,allCount:0,page:1,pageSize:24,
  platforms:[],categories:[],verifiedPurchasableCount:0,checkoutPath:"/shop",
  currency:"USD",firstPartyProductsUrl:"/api/catalog/v1"
 },{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
