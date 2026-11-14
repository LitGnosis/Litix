import {createHash,timingSafeEqual} from "node:crypto";
import {boosteroSQL,boosteroProductionReady} from "../../../../lib/boosteroFulfillment.mjs";
import {checkBoosteroBalance} from "../../../../lib/litixFulfillmentAutomation.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=15;
export async function GET(request){
 const expected=String(process.env.CRON_SECRET||"");
 const supplied=String(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(expected.length<24||supplied.length<24||
   !timingSafeEqual(createHash("sha256").update(expected).digest(),createHash("sha256").update(supplied).digest()))
  return Response.json({error:"unauthorized"},{status:401});
 if(!boosteroProductionReady())return Response.json({ready:false,error:"supplier_not_configured"},{status:503});
 try{
  const sql=boosteroSQL();
  const [balance,states]=await Promise.all([
   checkBoosteroBalance({sql,notify:true}),
   sql.query("select state,count(*)::integer as total from public.litix_boostero_fulfillment group by state")
  ]);
  return Response.json({ready:!balance.low,balanceUSD:balance.balance,thresholdUSD:50,
   supplierCurrency:balance.currency,ordersByState:states},
   {headers:{"cache-control":"no-store"}});
 }catch{return Response.json({ready:false,error:"supplier_health_unavailable"},{status:503});}
}
