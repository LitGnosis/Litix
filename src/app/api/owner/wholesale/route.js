// Private wholesale pricing and prepaid Boostero wallet checkout.
// No public pricing change; no card charge; all supplier calls server-side.
import {authenticatedOwner,ownerOrigin,ownerPostOrigin,ownerEmail,ownerHeaders,ownerDB} from "../../../../lib/litixOwnerWholesaleAuth.mjs";
import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {boosteroProductionReady,boosteroQuote,boosteroDestination} from "../../../../lib/boosteroFulfillment.mjs";
import {handleBoosteroOrder} from "../../../../lib/boosteroOrderHandler.mjs";
import {retiredAutoLikesService} from "../../../../lib/retiredAutolikes.mjs";
import {litixPurchasableDefault} from "../../../../lib/litixRetail60.mjs";
import {litixPlatform,litixKind} from "../../../../lib/litixServiceClassify.mjs";
import {publicServiceCardName} from "../../../../lib/serviceCardDisplay.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const reply=(body,status=200)=>Response.json(body,{status,headers:ownerHeaders});
const ownerCardPublicKey=()=>process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||
 process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY||"";
// Do not self-process owner-funded charges until the acquiring processor
// has explicitly confirmed this merchant-account use is permitted.
const ownerPayKingsReady=()=>process.env.LITIX_OWNER_PAYKINGS_ENABLED==="true"&&
 process.env.VERCEL_ENV==="production"&&process.env.NMI_GATEWAY_MODE!=="TEST"&&
 !!process.env.NMI_SECURITY_KEY&&
 !!ownerCardPublicKey();
const validOrderId=id=>/^ltx2_[0-9a-f-]{36}$/.test(String(id||""));
const ownerProxy=(request,adminToken,body)=>new Request(request.url,{
 method:"POST",headers:{"content-type":"application/json",
 "origin":new URL(request.url).origin,"authorization":"Bearer "+adminToken},
 body:JSON.stringify(body)
});
const idOf=value=>String(value||"").replace(/^litix_/,"");
const eligible=item=>!retiredAutoLikesService(item)&&litixPurchasableDefault(item)!==null;
const privateCard=item=>({
 id:String(item.service),name:publicServiceCardName({name:String(item.name||"Service")}),
 category:publicServiceCardName({name:String(item.category||"Other")}),
 platform:litixPlatform(item.name,item.category),kind:litixKind(item.name,item.category),
 rateUSDPer1000:Number(item.rate),min:litixPurchasableDefault(item),
 max:Number(item.max),usa:/(?:🇺🇸|\b(?:usa|u\.s\.a\.?|u\.s\.?|united states|american|america)\b)/i.test(String(item.name||"")+" "+String(item.category||""))
});
async function liveItem(serviceId){
 const id=idOf(serviceId);
 if(!/^\d{1,12}$/.test(id))throw Error("invalid_service");
 const all=await boosteroProduction("services");
 const item=all.find(s=>String(s?.service)===id);
 if(!item||!eligible(item))throw Error("service_not_available");
 return item;
}
async function liveQuote(body){
 const item=await liveItem(body?.serviceId),quantity=Number(body?.quantity);
 const quote=boosteroQuote({service:item,quantity});
 const destination=boosteroDestination(body?.destination,quote.platform,quote.kind);
 if(!destination)throw Error("invalid_public_profile_or_post_url");
 const wallet=await boosteroProduction("balance");
 const balanceUSD=Number(wallet.balance);
 if(!Number.isFinite(balanceUSD)||balanceUSD<0)throw Error("supplier_balance_unavailable");
 return {item,quote,destination,balanceUSD};
}
function whitelistError(error){
 const key=String(error?.message||"");
 return ["invalid_service","service_not_available","invalid_public_profile_or_post_url",
  "supplier_balance_unavailable","boostero_quantity_or_type_not_supported",
  "boostero_price_must_cover_60_percent_markup"].includes(key)?key:
  "Live wholesale quote unavailable. No purchase was submitted.";
}
export async function GET(request){
 if(!ownerOrigin(request))return reply({error:"owner_only"},403);
 if(!authenticatedOwner(request))return reply({error:"owner_login_required"},401);
 if(!boosteroProductionReady())return reply({error:"Supplier connection unavailable"},503);
 const url=new URL(request.url),view=url.searchParams.get("view")||"catalog";
 if(view==="order"){
  const id=String(url.searchParams.get("id")||"");
  if(!validOrderId(id))return reply({error:"invalid_order_id"},422);
  try{
   const rows=await ownerDB().query(
    "SELECT o.id,o.service_id,o.service_name,o.destination,o.quantity,o.amount_cents,o.supplier_cost_cents,o.payment_state,o.fulfillment_state,o.metadata->>'ownerPurpose' AS purpose,f.state AS delivery_state,f.supplier_order_id,f.error_code,f.supplier_status FROM public.litix_v2_orders o JOIN public.litix_boostero_fulfillment f ON f.litix_order_id=o.id WHERE o.id=$1 LIMIT 1",
    [id]);
   if(!rows.length)return reply({error:"order_not_found"},404);
   const order=rows[0];
   const replacementEligible=["FAILED","REJECTED"].includes(order.delivery_state)&&
    !order.supplier_order_id&&order.payment_state!=="review";
   return reply({order:{...order,replacementEligible,
    advice:replacementEligible?
     "Verified failed supplier submission: owner may explicitly authorize a new replacement order.":
     "Do not reorder this order without reconciling payment and supplier delivery first."}});
  }catch{return reply({error:"Order tracking temporarily unavailable"},503)}
 }
 if(view!=="catalog")return reply({error:"invalid_view"},400);
 try{
  const [data,wallet]=await Promise.all([boosteroProduction("services"),boosteroProduction("balance")]);
  const servicePriority=x=>x.platform==="Instagram"&&x.kind==="followers"?0:
    x.platform==="Instagram"?1:x.platform==="TikTok"&&x.kind==="followers"?2:
    x.platform==="TikTok"?3:4;
  const items=data.filter(eligible).map(privateCard).sort((a,b)=>
   // Display USA/American services first for owner shopping, then all others.
   // Do not delay or reprioritize existing customer or supplier orders.
   Number(b.usa)-Number(a.usa)||
   servicePriority(a)-servicePriority(b)||
   a.rateUSDPer1000-b.rateUSDPer1000||
   a.name.localeCompare(b.name));
  return reply({items,count:items.length,usaServices:items.filter(item=>item.usa).length,
   walletUSD:Number(wallet.balance),sort:"american_first_then_international",
   purchaseMethods:["paykings","supplier_balance"],paykingsEnabled:ownerPayKingsReady(),
   cardPublicKey:ownerPayKingsReady()?ownerCardPublicKey():null,
   publicPricesUnchanged:true,
   notice:"USA/American services first. Owner purchases can use PayKings or Boostero balance; customer retail prices and customer cards are unchanged."});
 }catch{return reply({error:"Supplier pricing or balance temporarily unavailable"},503)}
}
export async function POST(request){
 if(!ownerPostOrigin(request))return reply({error:"same_origin_required"},403);
 if(!authenticatedOwner(request))return reply({error:"owner_login_required"},401);
 if(!boosteroProductionReady())return reply({error:"Supplier connection unavailable"},503);
 if(Number(request.headers.get("content-length")||0)>5000)return reply({error:"request_too_large"},413);
 let body;try{body=await request.json()}catch{return reply({error:"invalid_json"},400)}
 if(!["quote","purchase","refill"].includes(body?.action))return reply({error:"unsupported_action"},400);
 if(body.action==="refill"){
  const orderId=String(body?.orderId||"");
  if(!validOrderId(orderId)||body.confirmed!==true)return reply({error:"An explicitly confirmed order ID is required for refill"},422);
  const admin=String(process.env.LITIX_BOOSTERO_ADMIN_TOKEN||"");
  if(admin.length<40)return reply({error:"Owner supplier action unavailable"},503);
  const result=await handleBoosteroOrder(ownerProxy(request,admin,{action:"refill",orderId}),{adminOnly:true});
  const answer=await result.json().catch(()=>({error:"Refill outcome requires review"}));
  return reply({...answer,cardCharged:false,paymentMethod:"supplier_refill"},result.status);
 }
 if(body.paymentMethod&&!["paykings","supplier_balance"].includes(body.paymentMethod))
  return reply({error:"invalid_payment_method"},422);
 const paymentMethod=body.paymentMethod||"paykings";
 try{
  const {quote,destination,balanceUSD}=await liveQuote(body);
  const wholesaleCents=quote.wholesaleCents;
  if(!Number.isSafeInteger(wholesaleCents)||wholesaleCents<=0||wholesaleCents>100000000)
   return reply({error:"invalid_wholesale_total"},422);
  const enough=balanceUSD+1e-7>=quote.costUSD;
  const chargeAmountCents=paymentMethod==="paykings"?Math.max(100,wholesaleCents):wholesaleCents;
  if(body.action==="quote")return reply({
   serviceId:quote.serviceId,quantity:quote.quantity,
   destination,wholesaleCents,wholesaleUSD:quote.costUSD,
   supplierBalanceUSD:balanceUSD,balanceEnough:enough,
   paymentMethod,chargeAmountCents,cardMinimumApplied:paymentMethod==="paykings"&&wholesaleCents<100,
   paykingsReady:ownerPayKingsReady(),
   publicRetailCents:quote.amountCents,
   note:paymentMethod==="paykings"?
    "Owner's PayKings card sale covers this wholesale supplier order. Card checkout minimum is $1; any excess above supplier cost is retained to cover processing. Settlement is distinct from gateway approval.":
    "Owner's Boostero wallet pays the supplier directly. No card charge."
  });
  if(body.confirmed!==true||Number(body.expectedWholesaleCents)!==wholesaleCents||
     Number(body.expectedChargeCents)!==chargeAmountCents)
   return reply({error:"Confirm the current wholesale payment amount before purchase. No order submitted."},409);
  if(paymentMethod==="paykings"&&!ownerPayKingsReady())
   return reply({error:"Owner PayKings card checkout is not configured; no charge attempted."},503);
  if(!enough)return reply({error:"Insufficient Boostero wallet funds. No order submitted."},409);
  const idem=String(body.idempotencyKey||"");
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(idem)||idem.length>40)
   return reply({error:"invalid_purchase_idempotency_key"},422);
  const admin=String(process.env.LITIX_BOOSTERO_ADMIN_TOKEN||"");
  if(admin.length<40)return reply({error:"Private owner order authentication unavailable"},503);
  const purpose=String(body.ownerPurpose||"personal");
  if(!["personal","promotion","giveaway","replacement"].includes(purpose))
   return reply({error:"Invalid order purpose"},422);
  const replacementOf=purpose==="replacement"?String(body.replacementOf||""):"";
  if(purpose==="replacement"&&!validOrderId(replacementOf))
   return reply({error:"Review a confirmed failed original order before any replacement"},422);
  const token=String(body.paymentToken||"");
  if(paymentMethod==="paykings"&&(token.length<10||token.length>500))
   return reply({error:"Secure PayKings token required; no card charge attempted."},422);
  const payload={
   action:paymentMethod==="paykings"?"owner_card_purchase":"admin_purchase",
   ownerWholesale:true,ownerPurpose:purpose,...(replacementOf?{replacementOf}:{}),
   serviceId:quote.serviceId,quantity:quote.quantity,
   destination,email:ownerEmail(),
   ...(paymentMethod==="paykings"?{paymentToken:token}:{approvedCostCents:wholesaleCents}),
   expectedAmountCents:chargeAmountCents,
   idempotencyKey:idem
  };
  const result=await handleBoosteroOrder(ownerProxy(request,admin,payload),{adminOnly:true});
  const answer=await result.json().catch(()=>({error:"owner_order_status_unavailable"}));
  // Owner card payments and wallet debits are distinguished from ordinary retail sales.
  const cardChargeStatus=paymentMethod==="paykings"?
    answer.payment==="paid"?"gateway_approved":
    answer.payment==="declined"?"declined":
    answer.orderId?"unknown_review_required":"not_attempted":"not_applicable";
  return reply({...answer,wholesaleCents,chargeAmountCents,
   paymentMethod:paymentMethod==="paykings"?"paykings":"boostero_prepaid_wallet",
   cardChargeStatus,...(paymentMethod==="supplier_balance"?{cardCharged:false}:{})},result.status);
 }catch(error){
  // Never report "no charge" after an exception whose timing is unknown.
  return reply({error:whitelistError(error),
   ...(body.action==="quote"?{chargeAttempted:false}:{cardChargeStatus:"unknown_review_required",doNotRetry:true})},
   503);
 }
}
