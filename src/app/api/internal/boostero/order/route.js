export const runtime="nodejs";
export const dynamic="force-dynamic";
/** New vendor-backed orders are disabled. Historic orders remain in Neon. */
export async function POST(){
 return Response.json({
  code:"FIRST_PARTY_ONLY",
  error:"Supplier order submission has been retired. Only approved owned-node jobs are eligible for dispatch.",
  supplierApiCalled:false,chargeAttempted:false
 },{status:410,headers:{"cache-control":"no-store"}});
}
