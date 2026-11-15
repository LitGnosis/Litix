import {boosteroSQL,hashBoostero} from "../../../../../lib/boosteroFulfillment.mjs";
import {publicServiceCardName} from "../../../../../lib/serviceCardDisplay.mjs";
import {boosteroSupplierDelivered} from "../../../../../lib/boosteroStatusBatch.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request){
 const p=new URL(request.url).searchParams,id=String(p.get("order")||""),token=String(p.get("token")||"");
 if(!/^ltx2_[a-f0-9-]{36}$/.test(id)||token.length<25||token.length>150)
  return Response.json({error:"Private order tracking link required"},{status:400});
 // Existing emailed links used to open a JSON API endpoint in Safari.
 // Navigate browsers to the branded Litix tracking page instead while
 // preserving JSON responses for fetch clients (/api/track).
 if((request.headers.get("accept")||"").includes("text/html")){
  const target=new URL("/track",request.url);
  target.searchParams.set("track",id);
  target.searchParams.set("token",token);
  return new Response(null,{status:303,headers:{"location":target.toString(),"cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex"}});
 }
 let found;
 try{
  found=await boosteroSQL().query(
   "select o.id,o.service_name,o.destination,o.quantity,o.amount_cents,o.payment_state,o.metadata,f.state,f.supplier_order_id,f.supplier_status,f.checked_at from public.litix_v2_orders o join public.litix_boostero_fulfillment f on f.litix_order_id=o.id where o.id=$1 and o.tracking_token_hash=$2",
   [id,hashBoostero(token)]);
 }catch{return Response.json({error:"Tracking currently unavailable"},{status:503})}
 if(found.length!==1)return Response.json({error:"Order not found"},{status:404});
 const x=found[0];
 let cartItems=[];
 if(x.metadata?.cart===true){
  try{
   const rows=await boosteroSQL().query(
    "select ordinal,service_name,service_kind,destination,quantity,retail_cents,state,supplier_status,start_count,checked_at,completed_at from public.litix_cart_lines where order_id=$1 order by ordinal",[id]);
   cartItems=rows.map(row=>({
    index:Number(row.ordinal),service:publicServiceCardName({name:row.service_name}),destination:row.destination,
    kind:row.service_kind,quantity:Number(row.quantity),amountCents:Number(row.retail_cents),
    status:row.supplier_status?.status||row.state,
    remains:row.supplier_status?.remains??null,startCount:row.start_count??null,
    checkedAt:row.checked_at||null,completedAt:row.completed_at||null
   }));
  }catch{return Response.json({error:"Order updates are temporarily unavailable"},{status:503})}
 }
 const curated=x.metadata?.curatedSku;
 const reorderUrl=x.payment_state==="paid"&&/^curated_(instagram|tiktok)_(followers|likes|views|comments)_(standard|vip)$/.test(String(curated||""))?
  "/?platform="+encodeURIComponent(String(curated).includes("_instagram_")?"Instagram":"TikTok")+
  "&service="+encodeURIComponent(curated)+"&qty="+encodeURIComponent(String(x.quantity))+
  "&link="+encodeURIComponent(String(x.metadata?.cart===true?
    (cartItems[0]?.destination||""):x.destination||""))+"#checkout":null;
 const allocations=Array.isArray(x.metadata?.postAllocations)?x.metadata.postAllocations.slice(0,5):[];
 let posts=allocations.map((p,i)=>({index:i+1,url:String(p.link||""),quantity:Number(p.quantity||0),
  status:x.state==="MANUAL_REVIEW"?"Needs fulfillment review":"Processing",remains:null}));
 if(allocations.length&&process.env.LITIX_MULTIPOST_AUTO_FULFILL_ENABLED==="true"){
  try{
   const children=await boosteroSQL().query(
    "select ordinal,destination,quantity,state,supplier_status,checked_at from public.litix_boostero_multi_posts where parent_order_id=$1 order by ordinal limit 5",[id]);
   if(children.length)posts=children.map(p=>({index:Number(p.ordinal),url:p.destination,quantity:Number(p.quantity),
    status:p.supplier_status?.status||p.state,remains:p.supplier_status?.remains??null,
    delivered:boosteroSupplierDelivered(p.quantity,p.supplier_status?.remains),checkedAt:p.checked_at||null}));
  }catch{}
 }
 return Response.json({order:{id:x.id,service:publicServiceCardName({name:x.service_name}),quantity:x.quantity,amountCents:x.amount_cents,
  payment:x.payment_state,fulfillment:x.state,
  supplierStatus:x.supplier_status?.status||null,remains:x.supplier_status?.remains??null,lastChecked:x.checked_at||null,posts,cartItems,reorderUrl}},
  {headers:{"cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex"}});
}
