import {timingSafeEqual} from "node:crypto";
import {boosteroProduction} from "../../../../../lib/boosteroReadOnly.mjs";
import {boosteroSQL} from "../../../../../lib/boosteroFulfillment.mjs";
import {importBoosteroInventory} from "../../../../../lib/boosteroInventorySync.mjs";
import {alertBoosteroInventorySync} from "../../../../../lib/boosteroInventoryAlerts.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const reply=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex"}});
function authorized(req,expected){
 const raw=String(req.headers.get("authorization")||"");
 const actual=raw.startsWith("Bearer ")?raw.slice(7):"";
 const value=String(expected||"");
 return value.length>=24&&value.length===actual.length&&timingSafeEqual(Buffer.from(actual),Buffer.from(value));
}
async function refresh(request,owner){
 if(process.env.VERCEL_ENV!=="production")return reply({error:"production_only"},404);
 const key=owner?process.env.LITIX_BOOSTERO_ADMIN_TOKEN:process.env.CRON_SECRET;
 if(!authorized(request,key))return reply({error:"unauthorized"},401);
 // Explicit future activation, AFTER additive migration and checkout review.
 if(process.env.LITIX_BOOSTERO_GLOBAL_SYNC_ENABLED!=="true")
  return reply({ok:true,skipped:"global_inventory_sync_not_enabled",productionUnchanged:true});
 if(process.env.LITIX_BOOSTERO_ENABLED!=="true")return reply({error:"boostero_disabled"},503);
 try{
  const result=await importBoosteroInventory(boosteroSQL(),await boosteroProduction("services"),{force:owner});
  return reply({ok:true,supplier:"boostero",...result});
 }catch(error){
  const msg=String(error?.message||"");
  const errorClass=/^inventory_[a-z0-9_]+$/.test(msg)?msg:"inventory_sync_unavailable";
  console.error("Boostero inventory sync rejected",errorClass);
  await alertBoosteroInventorySync(errorClass).catch(()=>{});
  return reply({ok:false,error:errorClass},503);
 }
}
// Vercel CRON authenticated independently of the owner refresh secret.
export async function GET(req){return refresh(req,false)}
export async function POST(req){return refresh(req,true)}
