// Retired public engagement product endpoint. Historical tracking and manage APIs remain intact.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(){
 return Response.json({error:"service_retired",chargeAttempted:false,checkoutEnabled:false},
  {status:410,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
