// Retired public engagement product endpoint. Historical tracking and manage APIs remain intact.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 return Response.json({items:[],platforms:[],available:false,checkoutEnabled:false},
  {status:410,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
