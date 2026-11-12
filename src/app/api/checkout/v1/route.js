/** Direct-only retail card endpoint. Supplier purchase APIs are never called. */
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const send=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
export async function POST(request){
  // This legacy URL is intentionally retained, so old saved checkout links
  // cannot bypass the new first-party purchase policy.
  const origin=new URL(request.url).origin;
  if(request.headers.get("origin")!==origin)return send({error:"same_origin_required"},403);
  if(Number(request.headers.get("content-length")||0)>8192)return send({error:"checkout_request_too_large"},413);
  let body;
  try{const raw=await request.text();if(raw.length>8192)throw Error("too_large");body=JSON.parse(raw)}
  catch{return send({error:"invalid_checkout_payload"},400)}
  // Numeric Litix IDs previously represented outsourced engagement services.
  // Never charge or forward them to a reseller or to a creative-kit node.
  if(body?.serviceId||body?.serviceKind!=="creative_kit"){
    return send({error:"This service has no verified Litix-owned fulfillment capacity. No payment attempted.",
      code:"FIRST_PARTY_SERVICE_UNAVAILABLE",payment:"NOT_ATTEMPTED",
      chargeAttempted:false,supplierApiCalled:false},409);
  }
  if(typeof body?.email!=="string"||typeof body?.paymentToken!=="string"||
    typeof body?.idempotencyKey!=="string"||
    !Number.isSafeInteger(body?.expectedAmountCents)||body.expectedAmountCents<100||
    !body?.brief||typeof body.brief!=="object"){
    return send({error:"valid_direct_order_required",chargeAttempted:false},422);
  }
  const base=process.env.LITIX_DIRECT_API_URL||"";
  const token=process.env.LITIX_INTERNAL_SERVICE_TOKEN||"";
  if(!/^https:\/\//.test(base)||token.length<32)
    return send({error:"first_party_payment_backend_unavailable",chargeAttempted:false},503);
  try{
    const url=new URL("/v1/internal/retail/checkout",base);
    const response=await fetch(url,{
      method:"POST",
      headers:{"content-type":"application/json","authorization":`Bearer ${token}`},
      body:JSON.stringify(body),cache:"no-store",redirect:"error",
      signal:AbortSignal.timeout(30000)
    });
    const result=await response.json().catch(()=>({detail:"invalid_owned_backend_reply"}));
    if(!response.ok)return send({error:result?.detail||"direct_checkout_unavailable",
      chargeAttempted:false},response.status);
    const payment=String(result.payment||"REVIEW");
    return send(result,payment==="APPROVED_PENDING_SETTLEMENT"||payment==="REVIEW"?202:
      payment==="DECLINED"?402:200);
  }catch{
    // A network timeout is ambiguous. The backend's idempotency ledger must
    // be reconciled, never charged again under a fresh key.
    return send({payment:"REVIEW",chargeAttempted:"unknown",
      error:"Checkout response unavailable. Do not resubmit; contact support."},202);
  }
}
