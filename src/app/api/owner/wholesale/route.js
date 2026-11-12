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
const idOf=value=>String(value||"").replace(/^litix_/,"");
const eligible=item=>!retiredAutoLikesService(item)&&litixPurchasableDefault(item)!==null;
const privateCard=item=>({
 id:String(item.service),name:publicServiceCardName({name:String(item.name||"Service")}),
 category:publicServiceCardName({name:String(item.category||"Other")}),
 platform:litixPlatform(item.name,item.category),kind:litixKind(item.name,item.category),
 rateUSDPer1000:Number(item.rate),min:litixPurchasableDefault(item),
 max:Number(item.max),usa:/\b(?:usa|u\.s\.a\.|united states|american)\b/i.test(String(item.name||"")+" "+String(item.category||""))
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
  if(!/^ltx2_[a-f0-9-]{36}$/.test(id))return reply({error:"invalid_order_id"},422);
  try{
   const rows=await ownerDB().query(
    "SELECT o.id,o.service_name,o.quantity,o.supplier_cost_cents,o.payment_state,o.fulfillment_state,f.state AS delivery_state,f.supplier_order_id,f.error_code,f.supplier_status FROM public.litix_v2_orders o JOIN public.litix_boostero_fulfillment f ON f.litix_order_id=o.id WHERE o.id=$1 AND o.metadata->>'ownerWholesale'='true' LIMIT 1",
    [id]);
   return rows.length?reply({order:rows[0]}):reply({error:"order_not_found"},404);
  }catch{return reply({error:"Order tracking temporarily unavailable"},503)}
 }
 if(view!=="catalog")return reply({error:"invalid_view"},400);
 try{
  const [data,wallet]=await Promise.all([boosteroProduction("services"),boosteroProduction("balance")]);
  const items=data.filter(eligible).map(privateCard).sort((a,b)=>{
   const aPriority=a.platform==="Instagram"&&a.kind==="followers"&&a.usa?0:
    a.platform==="Instagram"&&a.kind==="followers"?1:
    a.platform==="TikTok"&&a.kind==="followers"?2:3;
   const bPriority=b.platform==="Instagram"&&b.kind==="followers"&&b.usa?0:
    b.platform==="Instagram"&&b.kind==="followers"?1:
    b.platform==="TikTok"&&b.kind==="followers"?2:3;
   return aPriority-bPriority||a.rateUSDPer1000-b.rateUSDPer1000;
  });
  return reply({items,count:items.length,walletUSD:Number(wallet.balance),
   purchaseMethod:"boostero_prepaid_wallet",publicPricesUnchanged:true,
   notice:"Only this verified owner session can see supplier prices and submit prepaid-wallet orders. No PayKings charge."});
 }catch{return reply({error:"Supplier pricing or balance temporarily unavailable"},503)}
}
export async function POST(request){
 if(!ownerPostOrigin(request))return reply({error:"same_origin_required"},403);
 if(!authenticatedOwner(request))return reply({error:"owner_login_required"},401);
 if(!boosteroProductionReady())return reply({error:"Supplier connection unavailable"},503);
 if(Number(request.headers.get("content-length")||0)>5000)return reply({error:"request_too_large"},413);
 let body;try{body=await request.json()}catch{return reply({error:"invalid_json"},400)}
 if(!["quote","purchase"].includes(body?.action))return reply({error:"unsupported_action"},400);
 try{
  const {quote,destination,balanceUSD}=await liveQuote(body);
  const wholesaleCents=quote.wholesaleCents;
  if(!Number.isSafeInteger(wholesaleCents)||wholesaleCents<=0||wholesaleCents>100000000)
   return reply({error:"invalid_wholesale_total"},422);
  const enough=balanceUSD+1e-7>=quote.costUSD;
  if(body.action==="quote")return reply({
   serviceId:quote.serviceId,quantity:quote.quantity,
   destination,wholesaleCents,wholesaleUSD:quote.costUSD,
   supplierBalanceUSD:balanceUSD,balanceEnough:enough,
   publicRetailCents:quote.amountCents,
   note:"Boostero wallet charge only. Displayed cents round supplier fractional cents upward."
  });
  if(body.confirmed!==true||Number(body.expectedWholesaleCents)!==wholesaleCents)
   return reply({error:"Confirm the current wholesale total before purchase. No order submitted."},409);
  if(!enough)return reply({error:"Insufficient Boostero wallet funds. No order submitted."},409);
  const idem=String(body.idempotencyKey||"");
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(idem)||idem.length>40)
   return reply({error:"invalid_purchase_idempotency_key"},422);
  const admin=String(process.env.LITIX_BOOSTERO_ADMIN_TOKEN||"");
  if(admin.length<40)return reply({error:"Private owner order authentication unavailable"},503);
  const payload={
   action:"admin_purchase",ownerWholesale:true,
   serviceId:quote.serviceId,quantity:quote.quantity,
   destination,email:ownerEmail(),
   approvedCostCents:wholesaleCents,
   expectedAmountCents:quote.amountCents,
   idempotencyKey:idem
  };
  const proxy=new Request(request.url,{
   method:"POST",headers:{"content-type":"application/json",
    "origin":new URL(request.url).origin,"authorization":"Bearer "+admin},
   body:JSON.stringify(payload)
  });
  const result=await handleBoosteroOrder(proxy,{adminOnly:true});
  const answer=await result.json().catch(()=>({error:"owner_order_status_unavailable"}));
  // This records owner-authorized supplier-wallet spending, NOT revenue or a new card sale.
  return reply({...answer,wholesaleCents,paymentMethod:"boostero_prepaid_wallet",
   cardCharged:false},result.status);
 }catch(error){return reply({error:whitelistError(error),chargeAttempted:false},422)}
}
