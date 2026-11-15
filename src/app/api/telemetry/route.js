import {boosteroSQL} from "../../../lib/boosteroFulfillment.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=10;
const reply=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function GET(){
 if(!process.env.DATABASE_URL&&!process.env.LITIX_BOOSTERO_DATABASE_URL&&!process.env.LITIX_V2_DATABASE_URL)
  return reply({available:false,error:"telemetry_not_configured"},503);
 try{
  const sql=boosteroSQL();
  // The existing ledger records submission attempts, but does not provide
  // authoritative delivery-start timestamps. Never pass submission latency
  // off as actual delivery latency.
  const [orders,services]=await Promise.all([
   sql.query(`SELECT
    count(*) FILTER (WHERE state='COMPLETED' AND updated_at >= now()-interval '24 hours')::int AS completed,
    count(*) FILTER (WHERE state IN('QUEUED','DISPATCHING','SUBMITTED') AND updated_at >= now()-interval '24 hours')::int AS processing
    FROM public.litix_boostero_fulfillment`),
   sql.query(`SELECT count(*)::int AS active FROM public.litix_boostero_services
     WHERE enabled=true`)
  ]);
  return reply({available:true,windowHours:24,asOf:new Date().toISOString(),
   avgStartMinutes:null,ordersDeliveredToday:Number(orders[0]?.completed||0),
   ordersProcessing:Number(orders[0]?.processing||0),
   activeServicesCount:Number(services[0]?.active||0)});
 }catch(error){
  console.error("litix_telemetry_unavailable",{code:String(error?.code||"db_read_error").slice(0,32)});
  return reply({available:false,error:"telemetry_temporarily_unavailable"},503);
 }
}
