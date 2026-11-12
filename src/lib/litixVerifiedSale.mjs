// NMI Query API evidence for captured (not merely authorized) first-party sales.
// Only "pendingsettlement" and "complete" may release an already-approved digital job.
export const NMI_GATEWAY="https://paykings.transactiongateway.com";
const tag=(xml,name)=>new RegExp("<"+name+">([^<]{0,300})</"+name+">","i").exec(xml)?.[1]?.trim()||"";
const NONE=Object.freeze({captured:false,settled:false,condition:"unverified"});
export async function verifyNmiCapturedSale({orderId,transactionId,amountCents=100,securityKey}){
 if(!/^lpx_[0-9a-f]{32}$/.test(orderId)||
  !/^[0-9]{5,32}$/.test(transactionId)||String(securityKey||"").length<16||
  !Number.isSafeInteger(amountCents)||amountCents<100)return NONE;
 const reply=await fetch(NMI_GATEWAY+"/api/query.php",{
  method:"POST",cache:"no-store",redirect:"error",
  headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({security_key:securityKey,report_type:"transaction",transaction_id:transactionId}),
  signal:AbortSignal.timeout(11000)
 });
 if(!reply.ok)throw Error("nmi_query_unavailable");
 const xml=await reply.text();
 if(!xml||xml.length>150000)throw Error("nmi_invalid_query_response");
 const transaction=/<transaction(?:\s[^>]*)?>([\s\S]*?)<\/transaction>/i.exec(xml)?.[1]||"";
 if(tag(transaction,"transaction_id")!==transactionId||
   tag(transaction,"order_id")!==orderId||
   (tag(transaction,"currency")&&tag(transaction,"currency").toUpperCase()!=="USD")||
   (tag(transaction,"transaction_type")&&tag(transaction,"transaction_type")!=="cc"))
  return NONE;
 const condition=tag(transaction,"condition").toLowerCase();
 if(condition!=="pendingsettlement"&&condition!=="complete")return NONE;
 const actions=[...transaction.matchAll(/<action(?:\s[^>]*)?>([\s\S]*?)<\/action>/gi)].map(m=>m[1]);
 if(actions.some(action=>["void","refund","credit","return"].includes(tag(action,"action_type").toLowerCase())
   &&tag(action,"success")==="1"))return NONE;
 const sale=actions.some(action=>tag(action,"action_type").toLowerCase()==="sale"
   &&tag(action,"success")==="1"
   &&tag(action,"response_code")==="100"
   &&Math.round(Number(tag(action,"amount"))*100)===amountCents);
 if(!sale)return NONE;
 const settled=condition==="complete"&&actions.some(action=>
  tag(action,"action_type").toLowerCase()==="settle"&&tag(action,"success")==="1");
 if(condition==="complete"&&!settled)return NONE;
 return {captured:true,settled,condition};
}
