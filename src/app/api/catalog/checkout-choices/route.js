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
 let snapshot={items:[],status:"unavailable"};
 try{
  if(process.env.LITIX_BOOSTERO_ENABLED==="true")
   snapshot=await allBoosteroCardsSnapshot();
 }catch{/* Provider catalog call failed; use last known verified data. */}
 if(!snapshot.items?.length||snapshot.status==="unavailable"){
  snapshot=await readDurableCatalog();
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
