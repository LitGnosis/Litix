import {timingSafeEqual} from "node:crypto";
import {boosteroSQL} from "../../../../../lib/boosteroFulfillment.mjs";
import {ownerRequest,safeOrigin} from "../../../../../lib/ownerAuth.mjs";
import {pruneBoosteroRoutineLogs} from "../../../../../lib/boosteroSyncEvents.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=45;
const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"private, no-store","x-robots-tag":"noindex","x-content-type-options":"nosniff"}});
function scheduled(req){
 const expected=String(process.env.CRON_SECRET||"");
 const token=String(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 return expected.length>=24&&expected.length===token.length&&timingSafeEqual(Buffer.from(expected),Buffer.from(token));
}
async function maintenance(req,manual){
 if(process.env.VERCEL_ENV!=="production")return json({error:"production_only"},404);
 if(manual){
  if(!ownerRequest(req))return json({error:"owner_auth0_required"},401);
  if(!safeOrigin(req))return json({error:"invalid_origin"},403);
 }else if(!scheduled(req))return json({error:"cron_authorization_required"},401);
 if(process.env.LITIX_BOOSTERO_BACKUP_VERIFIED!=="true"||
    process.env.LITIX_BOOSTERO_LOG_RETENTION_APPROVED!=="true")
  return json({ok:true,skipped:"retention_not_enabled",deleted:0});
 try{
  const result=await pruneBoosteroRoutineLogs(boosteroSQL(),{days:14,batch:100,authorized:true});
  return json({ok:true,...result});
 }catch{
  return json({ok:false,error:"log_maintenance_unavailable",deleted:0},503);
 }
}
export async function GET(req){return maintenance(req,false)}
export async function POST(req){return maintenance(req,true)}
