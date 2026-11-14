import {boosteroSQL,boosteroProductionReady,dispatchBoostero} from "../../../../lib/boosteroFulfillment.mjs";
import {verifyPayKingsWebhook,parsePaidWebhook,verifyCapturedLitixSale} from "../../../../lib/litixFulfillmentSecurity.mjs";
import {recordCapturedCheckout,sendPendingConfirmations,flagUnknownSupplierOutcome} from "../../../../lib/litixFulfillmentAutomation.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const respond=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function POST(request){
 if(process.env.VERCEL_ENV!=="production"||process.env.LITIX_AUTOMATED_FULFILLMENT_ENABLED!=="true"||
    !boosteroProductionReady())return respond({error:"webhook_disabled"},503);
 const key=process.env.NMI_WEBHOOK_SIGNING_KEY;
 if(!key||!process.env.NMI_SECURITY_KEY)return respond({error:"payment_webhook_not_configured"},503);
 const body=await request.text();
 if(!verifyPayKingsWebhook(body,request.headers.get("webhook-signature"),key))
  return respond({error:"invalid_signature"},401);
 const data=parsePaidWebhook(body);
 if(!data)return respond({ignored:true});
 try{
  const verified=await verifyCapturedLitixSale({...data,securityKey:process.env.NMI_SECURITY_KEY});
  if(!verified)return respond({ignored:true,reason:"payment_not_captured"},202);
  const sql=boosteroSQL();
  const result=await recordCapturedCheckout(sql,data);
  if(!result.accepted)return respond({ignored:true,reason:result.reason},202);
  // Existing atomic QUEUED->DISPATCHING claim prevents duplicate Boostero purchases.
  // No direct supplier HTTP calls, no second order path.
  const dispatched=await dispatchBoostero(data.orderId,{sql}).catch(()=>({state:"needs_reconciliation"}));
  if(dispatched.requiresReview||dispatched.state==="UNKNOWN_OUTCOME"||dispatched.state==="MANUAL_REVIEW"||
     dispatched.state==="needs_reconciliation"){
   await flagUnknownSupplierOutcome({sql,orderId:data.orderId}).catch(()=>{});
  }
  if(result.recovered)await sendPendingConfirmations({sql,limit:1}).catch(()=>{});
  return respond({accepted:true,paymentVerified:true,fulfillment:dispatched.state||"queued"});
 }catch{
  // A retry is safe: the transaction and supplier dispatch each have durable
  // idempotency locks; an uncertain supplier add is NOT automatically repeated.
  return respond({error:"verification_or_ledger_unavailable"},503);
 }
}
