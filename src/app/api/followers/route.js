// Live Litix Followers checkout restricted to existing owner-approved mappings.
// No unmanaged supplier ID, free-form SKU, unverified price, or card number is accepted.
import {boosteroProductionReady,boosteroSQL,boosteroQuote} from "../../../lib/boosteroFulfillment.mjs";
import {boosteroProduction} from "../../../lib/boosteroReadOnly.mjs";
import {litixPurchasableDefault} from "../../../lib/litixRetail60.mjs";
import {litixPlatform,litixKind} from "../../../lib/litixServiceClassify.mjs";
import {handleBoosteroOrder} from "../../../lib/boosteroOrderHandler.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const send=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const accepted=new Set(["instagram","tiktok"]);
const RETAIL_CAP=50000;
async function selection(platform,quantity){
 if(!accepted.has(platform))throw Error("unsupported_platform");
 if(!boosteroProductionReady())throw Error("supplier_not_connected");
 const sql=boosteroSQL();
 const owners=await sql.query(
  "SELECT supplier_service_id FROM public.litix_boostero_services WHERE platform=$1 AND service_kind='followers' AND enabled=true AND approved_at IS NOT NULL AND approved_by IS NOT NULL ORDER BY approved_at LIMIT 1",
  [platform]);
 if(owners.length!==1)throw Error("follower_service_not_approved");
 const id=String(owners[0].supplier_service_id);
 const live=await boosteroProduction("services");
 const item=live.find(s=>String(s?.service)===id);
 if(!item||litixPlatform(item.name,item.category).toLowerCase()!==platform||
     litixKind(item.name,item.category)!=="followers")
  throw Error("live_follower_service_not_found");
 const min=litixPurchasableDefault(item);
 if(min===null)throw Error("follower_quantity_unavailable");
 const qty=quantity===null?min:quantity;
 const quote=boosteroQuote({service:item,quantity:qty});
 if(quote.kind!=="followers"||quote.platform.toLowerCase()!==platform||
   quote.amountCents>RETAIL_CAP)throw Error("follower_quote_not_approved");
 const bal=await boosteroProduction("balance");
 if(!Number.isFinite(Number(bal?.balance))||Number(bal.balance)<quote.costUSD)
  throw Error("supplier_wallet_unavailable");
 return {id,qty,quote,max:Number(item.max),min};
}
const externalMessage=(error)=>{
 const s=String(error?.message||"");
 if(s==="supplier_wallet_unavailable")return "Follower fulfillment balance is insufficient. No payment attempted.";
 if(s==="unsupported_platform")return "Choose Instagram or TikTok.";
 if(s==="follower_quantity_unavailable")return "No eligible quantity is available. No payment attempted.";
 return "Live follower delivery is not verified at this moment. No payment attempted.";
};
export async function GET(request){
 const u=new URL(request.url);
 const platform=(u.searchParams.get("platform")||"instagram").toLowerCase();
 const raw=u.searchParams.get("quantity");
 const qty=raw===null?null:/^[0-9]{1,7}$/.test(raw)?Number(raw):NaN;
 if(!accepted.has(platform)||Number.isNaN(qty)||qty===0)
  return send({available:false,error:"invalid_platform_or_quantity",chargeAttempted:false},422);
 try{
  const selected=await selection(platform,qty);
  return send({available:true,platform,name:(platform==="instagram"?"Instagram":"TikTok")+" Followers",
   quantity:selected.qty,minimum:selected.min,maximum:selected.max,amountCents:selected.quote.amountCents,
   currency:"USD",minChargeCents:100,checkoutEnabled:true,trackingPath:"/track",
   providerDeliveryVerifiedPreviously:platform==="instagram",actualDeliveryStatus:"not_yet_ordered",
   note:"Live supplier availability and funding checked. Delivery is tracked separately from payment authorization."});
 }catch(error){return send({available:false,checkoutEnabled:false,error:externalMessage(error),chargeAttempted:false},503)}
}
export async function POST(request){
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return send({error:"same_origin_required",chargeAttempted:false},403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
  return send({error:"json_required",chargeAttempted:false},415);
 if(Number(request.headers.get("content-length")||0)>5000)
  return send({error:"request_too_large",chargeAttempted:false},413);
 let input;
 try{input=await request.json()}catch{return send({error:"invalid_json",chargeAttempted:false},400)}
 const platform=String(input?.platform||"").toLowerCase();
 const qty=Number(input?.quantity);
 if(!accepted.has(platform)||!Number.isSafeInteger(qty)||qty<1||qty>1000000)
  return send({error:"invalid_follower_quantity",chargeAttempted:false},422);
 let chosen;
 try{chosen=await selection(platform,qty)}
 catch(error){return send({error:externalMessage(error),chargeAttempted:false},503)}
 if(Number(input?.expectedAmountCents)!==chosen.quote.amountCents)
  return send({error:"Live price changed. Refresh the quote before paying.",chargeAttempted:false},409);
 const payload={
  action:"card_purchase",serviceId:chosen.id,quantity:chosen.qty,
  email:input.email,destination:input.destination,
  expectedAmountCents:chosen.quote.amountCents,
  paymentToken:input.paymentToken,idempotencyKey:input.idempotencyKey
 };
 const headers=new Headers(request.headers);
 headers.delete("content-length");
 const proxy=new Request(request.url,{method:"POST",headers,body:JSON.stringify(payload)});
 // The existing audited PayKings/NMI + Boostero single-order ledger performs
 // a second fresh price/balance check, a single sale and a one-way supplier claim.
 return handleBoosteroOrder(proxy,{adminOnly:false});
}
