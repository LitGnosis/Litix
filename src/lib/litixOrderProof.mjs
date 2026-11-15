import {randomUUID} from "node:crypto";
export const litixProofEnabled=()=>process.env.LITIX_ORDER_PROOF_ENABLED==="true";
export function litixClientEvidence(request){
 const headers=request?.headers;
 const candidate=(headers?.get?.("x-vercel-forwarded-for")||headers?.get?.("x-forwarded-for")||"")
  .split(",")[0]?.trim()||"";
 const buyerIp=/^[a-fA-F0-9:.]{3,48}$/.test(candidate)?candidate:"";
 return {buyerIp,userAgent:String(headers?.get?.("user-agent")||"").slice(0,600)};
}
export async function recordOrderProof({sql,request,orderId,source="checkout"}){
 if(!litixProofEnabled())return {disabled:true};
 if(!/^ltx2_[a-f0-9-]{36}$/.test(String(orderId||"")))throw Error("invalid_proof_order");
 const evidence=litixClientEvidence(request);
 const rows=await sql.query(
  "insert into public.litix_order_proof(order_id,buyer_ip,user_agent,checkout_source) values($1,nullif($2,'')::inet,$3,$4) on conflict(order_id) do nothing returning order_id",
  [orderId,evidence.buyerIp,evidence.userAgent,source]);
 return {recorded:rows.length===1};
}
export async function recordProofEvent({sql,orderId,ordinal=null,eventType,details={}}){
 if(!litixProofEnabled())return {disabled:true};
 if(!/^ltx2_[a-f0-9-]{36}$/.test(String(orderId||"")))throw Error("invalid_proof_order");
 await sql.query(
  "insert into public.litix_order_proof_events(id,order_id,ordinal,event_type,details) values($1,$2,$3,$4,$5::jsonb)",
  [randomUUID(),orderId,ordinal,eventType,JSON.stringify(details)]);
 return {recorded:true};
}
