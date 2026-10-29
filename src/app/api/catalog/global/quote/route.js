import {createHmac,timingSafeEqual} from "node:crypto";
import {boosteroProduction,boosteroReadOnly} from "../../../../../lib/boosteroReadOnly.mjs";
import {normalizeBoosteroCatalog} from "../../../../../lib/boosteroGlobalCatalog.mjs";
import {validateBoosteroOrderDraft} from "../../../../../lib/boosteroFullOrderContracts.mjs";
import {quoteBoostero60Order} from "../../../../../lib/boosteroRetail60.mjs";
import {enabledBoosteroCards} from "../../../../../lib/boosteroCatalog.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=50;
const json=(value,status=200)=>Response.json(value,{status,headers:{"cache-control":"no-store","x-robots-tag":"noindex","x-content-type-options":"nosniff"}});
let catalog=null,expires=0,inflight=null;
async function live(){
 if(catalog&&Date.now()<expires)return catalog;
 if(!inflight)inflight=(async()=>{
  const raw=process.env.VERCEL_ENV==="production"?await boosteroProduction("services"):await boosteroReadOnly("services");
  const normalized=normalizeBoosteroCatalog(raw);
  if(normalized.items.length<100||normalized.stats.valid/Math.max(1,normalized.stats.retrieved)<.95)
   throw Error("incomplete_live_catalog");
  catalog=normalized.items;expires=Date.now()+120000;
  return catalog;
 })().finally(()=>{inflight=null});
 return inflight;
}
const cleanText=(s,n=100)=>String(s||"").replace(/[\u0000-\u001f]/g," ").slice(0,n);
const opaque=(id)=>"service_"+createHmac("sha256",process.env.BOOSTERO_API_KEY||"no-key").update(id).digest("hex").slice(0,24);
export async function POST(request){
 try{
  if(!["preview","production"].includes(process.env.VERCEL_ENV))
   return json({error:"unavailable"},404);
  if(Number(request.headers.get("content-length")||0)>8000)return json({error:"request_too_large"},413);
  const raw=await request.text();
  if(raw.length>8000)return json({error:"request_too_large"},413);
  let data;try{data=JSON.parse(raw)}catch{return json({error:"invalid_json"},400)}
  const id=String(data?.id||"");
  if(!/^service_[0-9a-f]{24}$/.test(id))return json({error:"invalid_service"},422);
  const services=await live();
  const record=services.find(s=>{const expected=opaque(s.id);return timingSafeEqual(Buffer.from(expected),Buffer.from(id))});
  if(!record)return json({error:"service_no_longer_available"},409);
  const safe={service:cleanText(record.name,180),orderType:record.type,minimum:record.min,maximum:record.max};
  const input=(data?.input&&typeof data.input==="object"&&!Array.isArray(data.input))?data.input:{};
  const draft=validateBoosteroOrderDraft(record,input);
  const approved=process.env.VERCEL_ENV==="production"
   ?(await enabledBoosteroCards().catch(()=>[])).find(x=>x.id==="boostero_"+record.id&&x.purchasable):null;
  if(!draft.valid){
   return json({...safe,validInput:false,reason:cleanText(draft.error||"invalid_service_input"),
    canPurchase:false,noPaymentAttempted:true,checkoutPath:null},200);
  }
  if(record.type!=="Default"){
   return json({...safe,validInput:true,canPurchase:false,noPaymentAttempted:true,
    reason:record.type==="Package"?"package_fixed_price_contract_not_verified":
      record.type==="Subscriptions"?"recurring_future_post_billing_not_verified":
      "special_service_billing_not_verified",
    checkoutPath:null},200);
  }
  const quantity=Number(draft.params.quantity),runs=Number(draft.params.runs||1);
  const existing=approved?Math.round(Number(approved.per1000)*100):null;
  const quote=quoteBoostero60Order({
   wholesaleUsdPer1000:record.wholesalePer1000,quantity,min:record.min,max:record.max,
   runs,existingApprovedRetailCents:existing
  });
  if(!quote.valid)return json({...safe,validInput:true,canPurchase:false,
   reason:cleanText(quote.reason),smallestEligibleQuantity:quote.smallestEligibleQuantity||null,
   noPaymentAttempted:true,checkoutPath:null},200);
  return json({...safe,validInput:true,quantity,runs,totalUnits:quote.totalUnits,
   customerAmountCents:quote.customerAmountCents,retailPer1000Cents:quote.retailPer1000Cents,
   canPurchase:!!approved&&runs===1,checkoutPath:approved&&runs===1?"/#custom-orders":null,
   reason:approved&&runs===1?"approved_live_purchase":"activation_pending_backend_approval",
   noPaymentAttempted:true,pricingVerifiedAgainstLiveSupplier:true},200);
 }catch{
  return json({error:"live_quote_temporarily_unavailable",noPaymentAttempted:true},503);
 }
}
export function GET(){return json({error:"post_required"},405)}
