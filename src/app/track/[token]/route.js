import {boosteroSQL,hashBoostero} from "../../../lib/boosteroFulfillment.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=12;
const headers={"cache-control":"no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex"};
export async function GET(request,{params}){
 const {token}=await params;
 if(!/^[a-f0-9]{64}$/.test(String(token||"")))
  return Response.json({error:"Invalid private tracking link"},{status:404,headers});
 try{
  const orders=await boosteroSQL().query(
   "select id from public.litix_v2_orders where tracking_token_hash=$1 limit 1",[hashBoostero(token)]);
  if(orders.length!==1)return Response.json({error:"Private tracking link not found"},{status:404,headers});
  const url=new URL("/track",request.url);
  url.searchParams.set("track",orders[0].id);
  url.searchParams.set("token",token);
  return new Response(null,{status:303,headers:{...headers,location:url.toString()}});
 }catch{
  return Response.json({error:"Private order lookup unavailable"},{status:503,headers});
 }
}
