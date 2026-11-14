import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {boosteroSQL,boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";
import {createHash,timingSafeEqual} from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const dig=s=>createHash("sha256").update(s).digest();
const authorized=req=>{
 const expected=String(process.env.CRON_SECRET||"");
 const token=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 return expected.length>=24&&token.length>=24&&timingSafeEqual(dig(expected),dig(token));
};
export async function GET(request){
 if(!authorized(request))return Response.json({error:"unauthorized"},{status:401});
 if(!boosteroProductionReady()||process.env.LITIX_AUTOMATED_FULFILLMENT_ENABLED!=="true")return Response.json({disabled:true});
 try{
  const live=await boosteroProduction("services");
  if(!Array.isArray(live)||live.length<1||live.length>12000)
   throw Error("catalog_source_unavailable");
  const active=live.filter(x=>/^\d{1,12}$/.test(String(x?.service||""))&&
    Number.isInteger(Number(x.min))&&Number.isInteger(Number(x.max))&&
    Number(x.min)>0&&Number(x.max)>=Number(x.min)&&
    Number.isFinite(Number(x.rate))&&Number(x.rate)>0)
    .map(x=>({id:String(x.service),min:Number(x.min),max:Number(x.max),rate:Number(x.rate)}));
  if(!active.length)throw Error("catalog_source_empty");
  const sql=boosteroSQL();
  const payload=JSON.stringify(active);
  const stored=await sql.query(
   "insert into public.litix_supplier_service_health(supplier_service_id,active,current_min,current_max,rate_usd_per_1000,last_seen_at,scanned_at) select x->>'id',true,(x->>'min')::integer,(x->>'max')::integer,(x->>'rate')::numeric,now(),now() from jsonb_array_elements($1::jsonb) x on conflict (supplier_service_id) do update set active=true,current_min=excluded.current_min,current_max=excluded.current_max,rate_usd_per_1000=excluded.rate_usd_per_1000,last_seen_at=now(),scanned_at=now()",
   [payload]);
  const paused=await sql.query(
   "update public.litix_supplier_service_health set active=false,scanned_at=now() where active=true and supplier_service_id not in (select x->>'id' from jsonb_array_elements($1::jsonb) x) returning supplier_service_id",
   [payload]);
  // Never auto-replace a missing service with a different supplier ID.
  // Fresh checkout still performs a separate live quote and enforces all limits.
  return Response.json({ok:true,checked:active.length,paused:paused.length,
   warning:paused.length?"Some supplier listings were paused; review live catalog":null},
   {headers:{"cache-control":"no-store"}});
 }catch{
  return Response.json({error:"daily_supplier_sync_unavailable"},{status:503});
 }
}
