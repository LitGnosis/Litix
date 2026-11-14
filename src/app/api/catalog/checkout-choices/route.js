import {allBoosteroCardsSnapshot} from "../../../../lib/boosteroCatalog.mjs";
import {buildCheckoutChoices} from "../../../../lib/litixCheckoutChoices.mjs";
import {readDurableCatalog} from "../../../../lib/litixDurableCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

// Service selection reads the SAME verified snapshot as /api/catalog/v1.
// Outages must not strand checkout at "Loading verified services", but cached
// cards are browse-only and never authorize a charge.
export async function GET(request){
 const requested=new URL(request.url).searchParams.get("platform")||"Instagram";
 // Read our already-verified local snapshot first: the selector must never
 // wait on a remote vendor timeout before showing fields. Checkout itself
 // continues to enforce fresh supplier verification and PayKings gate.
 let snapshot=await readDurableCatalog();
 if(!snapshot.items?.length){
  try{
   if(process.env.LITIX_BOOSTERO_ENABLED==="true")
    snapshot=await allBoosteroCardsSnapshot();
  }catch{/* Provider failure is reflected in the empty-state note. */}
 }
 const choices=buildCheckoutChoices(snapshot.items,requested);
 const hasItems=choices.items.length>0,live=snapshot.status==="live";
 return Response.json({...choices,currency:"USD",liveAvailability:live,
  catalogStatus:hasItems?(live?"live":"cached"):"unavailable",
  note:hasItems&&!live
   ?"Browse recently verified services. Secure checkout waits for a fresh supplier verification."
   :hasItems?"Choose your service, then enter the destination and verify the final price."
   :"No verified services are available right now. Please retry or contact support."
 },{status:200,headers:{"cache-control":hasItems&&live
    ?"public, s-maxage=20, stale-while-revalidate=40":"no-store",
   "x-content-type-options":"nosniff"}});
}
