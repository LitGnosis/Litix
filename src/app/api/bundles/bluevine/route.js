export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Do not collect bundle prepayments without first-party capacity per component. */
export async function POST(){
 return Response.json({
  code:"FIRST_PARTY_BUNDLE_CAPACITY_UNVERIFIED",
  error:"Bundle prepayment is paused until each included service can be delivered by Litix-owned nodes.",
  paymentInitiated:false,supplierApiCalled:false
 },{status:409,headers:{"cache-control":"no-store"}});
}
