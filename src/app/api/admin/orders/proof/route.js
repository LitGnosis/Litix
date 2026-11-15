import {boosteroAdminAuthorized,boosteroSQL} from "../../../../../lib/boosteroFulfillment.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=20;
const noStore={"cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex","x-content-type-options":"nosniff"};
const cell=x=>{
 const raw=String(x??"");
 const value=/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw;
 return '"'+value.replaceAll('"','""')+'"';
};
export function orderProofCSV(proof){
 const lines=["field,value"];
 const put=(key,value)=>lines.push(cell(key)+","+cell(value));
 const o=proof.order||{},ip=proof.proof||{};
 put("Litix Order",o.id);
 put("Payment State",o.payment_state);
 put("Checkout Email",o.email);
 put("Buyer IP",ip.buyer_ip);
 put("User Agent",ip.user_agent);
 put("Verified Destination",o.destination);
 put("PayKings Transaction",o.payment_transaction_id);
 put("Total Paid USD",(Number(o.amount_cents)/100).toFixed(2));
 put("Checkout Timestamp",o.created_at);
 for(const line of proof.lines||[]){
  put("Line "+line.ordinal+" Service",line.service_name);
  put("Line "+line.ordinal+" Quantity",line.quantity);
  put("Line "+line.ordinal+" Supplier Order",line.supplier_order_id);
  put("Line "+line.ordinal+" Start Count",line.start_count);
  put("Line "+line.ordinal+" Status",line.supplier_status?.status||line.state);
  put("Line "+line.ordinal+" Completed At",line.completed_at);
 }
 for(const [index,event] of (proof.events||[]).entries()){
  put("Audit Event "+(index+1)+" Type",event.event_type);
  put("Audit Event "+(index+1)+" At",event.occurred_at);
  put("Audit Event "+(index+1)+" Details",JSON.stringify(event.details||{}));
 }
 return lines.join("\r\n")+"\r\n";
}
export async function GET(request){
 if(!boosteroAdminAuthorized(request.headers.get("authorization")))
  return Response.json({error:"Unauthorized"},{status:401,headers:noStore});
 const url=new URL(request.url);
 const id=url.searchParams.get("orderId")||"";
 if(!/^ltx2_[a-f0-9-]{36}$/.test(id))
  return Response.json({error:"Invalid order number"},{status:422,headers:noStore});
 try{
  const sql=boosteroSQL();
  const [orders,proof,lines,events]=await Promise.all([
   sql.query("select id,email,service_name,destination,quantity,amount_cents,payment_state,payment_transaction_id,created_at from public.litix_v2_orders where id=$1 limit 1",[id]),
   sql.query("select buyer_ip::text,user_agent,checkout_source,captured_at from public.litix_order_proof where order_id=$1",[id]),
   sql.query("select ordinal,service_name,quantity,supplier_order_id,start_count,supplier_status,state,checked_at,completed_at from public.litix_cart_lines where order_id=$1 order by ordinal",[id]),
   sql.query("select ordinal,event_type,details,occurred_at from public.litix_order_proof_events where order_id=$1 order by occurred_at,id",[id])
  ]);
  if(orders.length!==1)return Response.json({error:"Order not found"},{status:404,headers:noStore});
  const summary={order:orders[0],proof:proof[0]||null,lines,events};
  if(url.searchParams.get("format")==="csv")
   return new Response(orderProofCSV(summary),{status:200,headers:{...noStore,
    "content-type":"text/csv; charset=utf-8",
    "content-disposition":'attachment; filename="litix-order-proof-'+id+'.csv"'}});
  return Response.json(summary,{headers:noStore});
 }catch{
  return Response.json({error:"Proof records temporarily unavailable"},{status:503,headers:noStore});
 }
}
