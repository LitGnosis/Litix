// Public independent-supply readiness. Strictly no supplier API calls,
// payment processing, booking, inventory reservation, or contract disclosure.
import {litixNativeSupplySnapshot} from "../../../../../lib/litixNativeSupplyCapacity.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={
 "cache-control":"no-store",
 "x-content-type-options":"nosniff",
 "referrer-policy":"no-referrer"
};
export async function GET(){
 const snapshot=litixNativeSupplySnapshot({env:process.env});
 return Response.json(snapshot,{status:200,headers});
}
export async function POST(){
 return Response.json({error:"CAPACITY_BOOKING_NOT_ACTIVATED",orderCreated:false,charged:false},
  {status:405,headers:{...headers,allow:"GET"}});
}
