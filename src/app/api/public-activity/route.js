import {boosteroSQL} from "../../../lib/boosteroFulfillment.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=10;

const headers={
 "cache-control":"public, s-maxage=120, stale-while-revalidate=300",
 "x-content-type-options":"nosniff"
};

export async function GET(){
 if(process.env.VERCEL_ENV!=="production")
  return Response.json({available:false},{headers});
 try{
  const results=await boosteroSQL().query(
   `select count(*)::int as count
      from public.litix_v2_orders o
      join public.litix_boostero_fulfillment f on f.litix_order_id=o.id
     where o.payment_state='paid'
       and f.supplier_order_id is not null
       and f.state in ('SUBMITTED','COMPLETED')
       and o.created_at>=now()-interval '24 hours'`
  );
  const count=Number(results[0]?.count||0);
  if(!Number.isSafeInteger(count)||count<5)
   return Response.json({available:false},{headers});
  return Response.json({
   available:true,
   verifiedDispatchedOrders24h:count,
   metric:"confirmed_supplier_order_ids"
  },{headers});
 }catch{
  return Response.json({available:false},{headers});
 }
}
