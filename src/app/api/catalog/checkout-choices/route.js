export const runtime="nodejs";
export const dynamic="force-dynamic";
// Retire all platform and social-service selectors; keep safe empty schema for old clients.
export async function GET(){
 return Response.json({platforms:[],kinds:[],items:[],total:0,
  checkoutEnabled:false,firstPartyShopUrl:"/shop"},
  {headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
