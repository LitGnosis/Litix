// Supplier catalog sync for the retired provider is permanently disabled.
// Boostero services are vetted at the read-only approved catalog endpoint.
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 return Response.json({error:"Retired supplier synchronization disabled; Boostero only.",retired:true},
  {status:410,headers:{"cache-control":"no-store"}});
}
