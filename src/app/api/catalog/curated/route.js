import {boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";
import {curatedPublicCatalog} from "../../../../lib/curatedCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=15;
export async function GET(){
 if(!boosteroProductionReady())
  return Response.json({products:[],error:"Live service verification is unavailable"},
   {status:503,headers:{"cache-control":"no-store"}});
 try{
  const result=await curatedPublicCatalog();
  return Response.json(result,{headers:{"cache-control":"no-store",
   "x-content-type-options":"nosniff"}});
 }catch{
  return Response.json({products:[],error:"Selected services are temporarily unavailable. No payment attempted."},
   {status:503,headers:{"cache-control":"no-store"}});
 }
}
