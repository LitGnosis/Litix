import {allBoosteroCardsSnapshot} from "../../../../lib/boosteroCatalog.mjs";
import {buildActiveStorefrontCatalog} from "../../../../lib/activeStorefrontCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
// Boostero is the exclusive NEW-ORDER storefront catalog.
// No historical supplier API fetch, old numeric SKUs, or supplier fallback.
export async function GET(request){
 const params=new URL(request.url).searchParams;
 let snapshot={items:[],status:"unavailable"};
 try{
  if(process.env.LITIX_BOOSTERO_ENABLED==="true")snapshot=await allBoosteroCardsSnapshot();
 }catch{
  // No backup supplier, no unlimited stale data. Checkout remains authoritative.
 }
 const listed=buildActiveStorefrontCatalog(snapshot.items,params,{sourceStatus:snapshot.status});
 // The legacy paid checkout was retired: there is no verified first-party
 // dispatch for its old numeric catalog IDs. Never advertise a service as
 // purchasable if /api/checkout/v1 will reject it before charging.
 const data={
  ...listed,
  items:listed.items.map(x=>({...x,purchasable:false})),
  recommendations:listed.recommendations.map(x=>({...x,purchasable:false})),
  checkoutEnabled:false,
  paidFirstPartyTestUrl:"/pilot",
  paidFirstPartyTestAmountCents:100,
  paidFirstPartyTestProduct:"12 original Litix marketing drafts",
  message:"Paid checkout for these services is unavailable until first-party fulfillment is verified. No payment will be attempted."
 };
 // Public pricing and categories only: never cache payment, user or tracking data.
 // The checkout handler independently obtains a fresh quote before charging.
 // An empty or unavailable catalog is never stored at the edge.
 const cacheControl="no-store";
 return Response.json(data,{
  headers:{"cache-control":cacheControl,"x-content-type-options":"nosniff"}
 });
}
