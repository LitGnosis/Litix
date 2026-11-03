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
 const data=buildActiveStorefrontCatalog(snapshot.items,params,{sourceStatus:snapshot.status});
 // Public pricing and categories only: never cache payment, user or tracking data.
 // The checkout handler independently obtains a fresh quote before charging.
 // An empty or unavailable catalog is never stored at the edge.
 const cacheControl=data.allCount>0
  ?snapshot.status==="live"
   ?"public, s-maxage=30, stale-while-revalidate=60"
   :"public, s-maxage=10, stale-while-revalidate=20"
  :"no-store";
 return Response.json(data,{
  headers:{"cache-control":cacheControl,"x-content-type-options":"nosniff"}
 });
}
