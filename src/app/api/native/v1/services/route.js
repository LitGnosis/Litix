import {litixNativeServices} from "../../../../../lib/litixNativeSupplier.mjs";
const headers={"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
export const runtime="nodejs";
export async function GET(){
 return Response.json({
  supplier:"Litix Native",
  version:"v1",
  mode:"FREE_FIRST_PARTY_PREVIEW",
  paidCheckoutEnabled:false,
  externalSupplierRequired:false,
  services:litixNativeServices()
 },{status:200,headers});
}
