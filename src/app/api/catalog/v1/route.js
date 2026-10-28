import {enabledBoosteroCards} from "../../../../lib/boosteroCatalog.mjs";
import {buildActiveStorefrontCatalog} from "../../../../lib/activeStorefrontCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
// Boostero is the exclusive NEW-ORDER storefront catalog.
// No historical supplier API fetch, old numeric SKUs, or supplier fallback.
export async function GET(request){
 const params=new URL(request.url).searchParams;
 let rows=[];
 try{
  if(process.env.LITIX_BOOSTERO_ENABLED==="true")rows=await enabledBoosteroCards();
 }catch{
  // Fail closed. Never publish unverifiable services or substitute a retired provider.
 }
 return Response.json(buildActiveStorefrontCatalog(rows,params),{
  headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}
 });
}
