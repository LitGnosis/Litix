import {POST as lookup} from "../[action]/route.js";
import {boosteroSQL} from "../../../lib/boosteroFulfillment.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"cache-control":"no-store","referrer-policy":"no-referrer"};
export async function POST(request){
 let input;
 try{input=await request.clone().json()}catch{return Response.json({error:"Invalid order details"},{status:400,headers});}
 const u=new URL(request.url);
 u.pathname="/api/lookup-order";
 const response=await lookup(new Request(u,request));
 if(!response.ok)return response;
 const payload=await response.json();
 if(payload.order?.payment!=="paid")return Response.json(payload,{headers});
 const id=String(input?.orderId||"").trim(),email=String(input?.email||"").trim().toLowerCase();
 if(!/^ltx2_[a-f0-9-]{36}$/.test(id)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  return Response.json(payload,{headers});
 try{
  const rows=await boosteroSQL().query(
   "select id,service_id,quantity,destination,metadata from public.litix_v2_orders where id=$1 and lower(email)=$2 and payment_state='paid' limit 1",[id,email]);
  if(rows.length!==1)return Response.json(payload,{headers});
  const order=rows[0],sku=order.metadata?.curatedSku;
  const curated=/^curated_(instagram|tiktok)_(followers|likes|views|comments)_(standard|vip)$/.test(String(sku||""));
  const service=curated?sku:"litix_"+String(order.service_id||"");
  if(!/^(?:curated_(?:instagram|tiktok)_[a-z_]+|litix_\d{1,12})$/.test(service))
   return Response.json(payload,{headers});
  const url=new URL("/",request.url);
  if(curated)url.searchParams.set("platform",service.split("_")[1]==="instagram"?"Instagram":"TikTok");
  url.searchParams.set("service",service);
  url.searchParams.set("qty",String(order.quantity));
  url.searchParams.set("link",String(order.destination||""));
  url.hash="checkout";
  payload.order.reorderUrl=url.pathname+url.search+url.hash;
 }catch{}
 return Response.json(payload,{headers});
}
