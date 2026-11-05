// Private Litix Native order lookup. No cards, sales, supplier dispatch,
// or paid download without a matching NMI settled transaction.
import {neon} from "@neondatabase/serverless";
import {after} from "next/server";
import {statusNativePaid,sendNativePaidDelivery} from "../../../../../../lib/litixNativePaidEngine.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"cache-control":"no-store, private","x-content-type-options":"nosniff",
 "referrer-policy":"no-referrer","x-robots-tag":"noindex, nofollow"};
const send=(body,status)=>Response.json(body,{status,headers});
export async function GET(request){
 const url=new URL(request.url),id=url.searchParams.get("id"),token=url.searchParams.get("token");
 if(!/^[a-f0-9-]{36}$/i.test(String(id||""))||!/^[a-f0-9]{64}$/.test(String(token||"")))
  return send({error:"INVALID_PRIVATE_ORDER_LINK"},400);
 if(!process.env.LITIX_NATIVE_DATABASE_URL||!process.env.LITIX_NATIVE_ORDER_SECRET)
  return send({error:"NATIVE_ORDER_LOOKUP_UNAVAILABLE"},503);
 let sql;
 try{sql=neon(process.env.LITIX_NATIVE_DATABASE_URL);}
 catch{return send({error:"NATIVE_ORDER_LOOKUP_UNAVAILABLE"},503);}
 const result=await statusNativePaid({orderId:id,token,env:process.env,sql});
 if(result.body?.delivered===true){
  // Durable DB outbox makes this safe to invoke for each verified customer
  // lookup; only a single worker can claim its PENDING event.
  after(()=>sendNativePaidDelivery({orderId:id,env:process.env,sql}).catch(()=>{}));
 }
 return send(result.body,result.http);
}
export async function POST(){return send({error:"READ_ONLY_PRIVATE_ORDER"},405);}
