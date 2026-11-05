/**
 * Litix Native price and settlement policy.
 * No pricing enabled by default; real prices + cost reserves must be explicitly
 * approved via protected server-side configuration.
 * No supplier or payment side effects in this module.
 */
import {NATIVE_PREMIUM_PRODUCTS,createNativePremiumAsset} from "./litixNativePremiumAssets.mjs";
import {createHash,createHmac,timingSafeEqual} from "node:crypto";

const sha=s=>createHash("sha256").update(s).digest("hex");
export const nativeOrderToken=(id,secret)=>{
 if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id)||
    typeof secret!=="string"||secret.length<32)throw Error("NATIVE_ORDER_SECRET_INVALID");
 return createHmac("sha256",secret).update("litix-native-paid-v1/"+id).digest("hex");
};
export const nativeTokenValid=(id,token,secret)=>{
 try{
  if(!/^[a-f0-9]{64}$/.test(String(token)))return false;
  const a=Buffer.from(nativeOrderToken(id,secret),"hex"),b=Buffer.from(token,"hex");
  return timingSafeEqual(a,b);
 }catch{return false;}
};
export const nativeEmailValid=x=>typeof x==="string"&&x.length<255&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
export const nativeRequestIdValid=x=>typeof x==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);

/** Set explicit, approved prices AND COGS. Never trust client-side amounts. */
export function nativePaidQuote({serviceId,brief,env={}}={}){
 if(env.LITIX_NATIVE_PAID_ENABLED!=="true")throw Error("NATIVE_PAID_DISABLED");
 if(!NATIVE_PREMIUM_PRODUCTS.some(x=>x.id===serviceId))throw Error("NATIVE_SERVICE_UNSUPPORTED");
 let config;try{config=JSON.parse(String(env.LITIX_NATIVE_PRICES_JSON||"{}"));}
 catch{throw Error("NATIVE_PRICES_NOT_APPROVED");}
 const entry=config?.[serviceId];
 const price=entry?.priceCents,cost=entry?.costCents,reserve=entry?.supportReserveCents;
 if(!Number.isSafeInteger(price)||price<300||price>20000||
    !Number.isSafeInteger(cost)||cost<0||cost>price||
    !Number.isSafeInteger(reserve)||reserve<50||reserve>price)
  throw Error("NATIVE_PRICES_NOT_APPROVED");
 // Conservative platform-fee estimate; actual gateway rate must be reconciled.
 const gatewayFee=Math.ceil(price*.035)+30;
 const margin=price-cost-reserve-gatewayFee;
 if(margin<Math.ceil(price*.25))throw Error("NATIVE_MARGIN_BELOW_FLOOR");
 const asset=createNativePremiumAsset({serviceId,brief});
 if(asset.content.length>25000)throw Error("NATIVE_ASSET_TOO_LARGE");
 return Object.freeze({serviceId,priceCents:price,directCostCents:cost,
  supportReserveCents:reserve,estimatedGatewayFeeCents:gatewayFee,
  estimatedMarginCents:margin,asset,briefHash:sha(JSON.stringify({serviceId,assetHash:asset.sha256}))});
}
const tag=(str,key)=>String(str).match(new RegExp("<"+key+">([\\s\\S]*?)<\\/"+key+">","i"))?.[1]?.trim()||"";
const amountCents=s=>{
 if(!/^\d{1,6}\.\d{2}$/.test(s))return null;
 const [a,b]=s.split(".");return Number(a)*100+Number(b);
};
/**
 * NMI Classic Query XML: exact transaction+order+USD amount, success sale
 * and "complete" condition (NMI definition: *settled*).
 * Any refund/void/chargeback action blocks fulfillment.
 * Never persist or log the raw gateway report: it can include card/PII.
 */
export function verifyNativeNmiSettlement(xml,{transactionId,orderId,amountCents:expected}={}){
 if(typeof xml!=="string"||xml.length>500000||!xml.includes("<nm_response")||
   !/^[0-9A-Za-z-]{3,100}$/.test(String(transactionId||""))||
   !/^[a-f0-9-]{36}$/i.test(String(orderId||""))||
   !Number.isSafeInteger(expected)||expected<1)return {settled:false,reason:"INVALID_EVIDENCE"};
 const matches=[...xml.matchAll(/<transaction(?:\s[^>]*)?>([\s\S]*?)<\/transaction>/gi)]
  .map(x=>x[1]).filter(x=>tag(x,"transaction_id")===transactionId);
 if(matches.length!==1)return {settled:false,reason:"TRANSACTION_NOT_UNIQUE"};
 const t=matches[0];
 if(tag(t,"order_id")!==orderId)return {settled:false,reason:"ORDER_MISMATCH"};
 if(tag(t,"currency").toUpperCase()!=="USD")return {settled:false,reason:"CURRENCY_UNVERIFIED"};
 if(tag(t,"condition")!=="complete")return {settled:false,reason:"NOT_SETTLED"};
 const actions=[...t.matchAll(/<action(?:\s[^>]*)?>([\s\S]*?)<\/action>/gi)].map(m=>m[1]);
 if(actions.some(a=>tag(a,"success")==="1"&&/^(refund|void|credit|return|chargeback)$/i.test(tag(a,"action_type"))))
  return {settled:false,reason:"REVERSED"};
 const sales=actions.filter(a=>tag(a,"action_type")==="sale"&&tag(a,"success")==="1"&&
   amountCents(tag(a,"amount"))===expected);
 if(sales.length!==1)return {settled:false,reason:"SALE_AMOUNT_UNVERIFIED"};
 return {settled:true,reason:"SETTLED"};
}
