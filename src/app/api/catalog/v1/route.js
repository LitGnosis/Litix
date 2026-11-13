import {after} from "next/server";
import {allBoosteroCardsSnapshot} from "../../../../lib/boosteroCatalog.mjs";
import {buildActiveStorefrontCatalog} from "../../../../lib/activeStorefrontCatalog.mjs";
import {persistVerifiedCatalog,readDurableCatalog} from "../../../../lib/litixDurableCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

// Supplier reads are best-effort; verified public cards survive cold starts and
// supplier API outages in the Litix database. Cached cards never authorize
// new payments or supplier dispatch.
export async function GET(request){
 const params=new URL(request.url).searchParams;
 let snapshot={items:[],status:"unavailable"};
 try{
  if(process.env.LITIX_BOOSTERO_ENABLED==="true")snapshot=await allBoosteroCardsSnapshot();
 }catch{ /* Vendor API unavailable. Read durable Litix cache below. */ }
 if(snapshot.status==="live" && snapshot.items.length){
  after(()=>persistVerifiedCatalog(snapshot.items).catch(()=>{}));
 }
 if(!snapshot.items?.length || snapshot.status==="unavailable"){
  snapshot=await readDurableCatalog();
 }
 const listed=buildActiveStorefrontCatalog(snapshot.items,params,{sourceStatus:snapshot.status});
 const isFresh=snapshot.status==="live";
 const data={
  ...listed,
  // Previously verified cards are informational until a live order quote passes.
  checkoutEnabled:isFresh&&listed.allCount>0&&snapshot.items.some(x=>x.purchasable===true),
  currency:"USD",
  catalogFresh:isFresh
 };
 const cacheControl=listed.allCount>0
  ?isFresh?"public, s-maxage=30, stale-while-revalidate=60"
          :"public, s-maxage=10, stale-while-revalidate=20"
  :"no-store";
 return Response.json(data,{
  headers:{"cache-control":cacheControl,"x-content-type-options":"nosniff"}
 });
}
