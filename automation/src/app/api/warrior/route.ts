import {createHash,timingSafeEqual} from "node:crypto";
import {runWarriorCycle} from "../../../cron-engine.js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!secret||!token)return Response.json({error:"unauthorized"},{status:401});
  const a=createHash("sha256").update(secret).digest();
  const b=createHash("sha256").update(token).digest();
  if(!timingSafeEqual(a,b))return Response.json({error:"unauthorized"},{status:401});
  if(process.env.VERCEL_ENV!=="production")
    return Response.json({ok:true,skipped:"not_production"});
  try{return Response.json({ok:true,...await runWarriorCycle()});}
  catch{return Response.json({ok:false,error:"warrior_check_failed"},{status:503});}
}
