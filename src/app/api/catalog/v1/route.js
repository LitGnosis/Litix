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
 return Response.json(buildActiveStorefrontCatalog(snapshot.items,params,{sourceStatus:snapshot.status}),{
  headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}
 });
}
