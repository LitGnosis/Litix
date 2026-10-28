import {boosteroSQL,hashBoostero} from "../../../../../lib/boosteroFulfillment.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request){
 const p=new URL(request.url).searchParams,id=String(p.get("order")||""),token=String(p.get("token")||"");
 if(!/^ltx2_[a-f0-9-]{36}$/.test(id)||token.length<25||token.length>150)
  return Response.json({error:"Private order tracking link required"},{status:400});
 let found;
 try{
  found=await boosteroSQL().query(
   "select o.id,o.service_name,o.quantity,o.amount_cents,o.payment_state,f.state,f.supplier_order_id,f.supplier_status,f.checked_at from public.litix_v2_orders o join public.litix_boostero_fulfillment f on f.litix_order_id=o.id where o.id=$1 and o.tracking_token_hash=$2",
   [id,hashBoostero(token)]);
 }catch{return Response.json({error:"Tracking currently unavailable"},{status:503})}
 if(found.length!==1)return Response.json({error:"Order not found"},{status:404});
 const x=found[0];
 return Response.json({order:{id:x.id,service:x.service_name,quantity:x.quantity,amountCents:x.amount_cents,
  payment:x.payment_state,fulfillment:x.state,
  supplierStatus:x.supplier_status?.status||null,lastChecked:x.checked_at||null}},
  {headers:{"cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex"}});
}
