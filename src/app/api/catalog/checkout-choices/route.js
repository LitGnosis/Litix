import {allBoosteroCardsSnapshot} from "../../../../lib/boosteroCatalog.mjs";
import {buildCheckoutChoices} from "../../../../lib/litixCheckoutChoices.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

// All options come from the exact same approved catalog as /api/checkout/v1.
// Never expose provider IDs, wholesale rates, credentials or raw supplier data.
export async function GET(request){
 const requested=new URL(request.url).searchParams.get("platform")||"Instagram";
 try{
  const snapshot=process.env.LITIX_BOOSTERO_ENABLED==="true"?
   await allBoosteroCardsSnapshot():{items:[],status:"unavailable"};
  const choices=buildCheckoutChoices(snapshot.items,requested);
  if(!choices.items.length)return Response.json({
   platforms:choices.platforms,platform:choices.platform,kinds:[],items:[],total:0,
   error:"Litix services are temporarily unavailable. No payment attempted."
  },{status:503,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  return Response.json({...choices,currency:"USD",liveAvailability:snapshot.status==="live",
   note:snapshot.status==="cached"?
    "Recently verified services. Prices and availability are checked again before payment.":
    "Select a verified service; the final total is checked before payment."},
   {headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }catch{
  return Response.json({platforms:[],kinds:[],items:[],total:0,
   error:"Litix services are temporarily unavailable. No payment attempted."},
   {status:503,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }
}
