import {nativePaidQuote} from "./litixNativeCommercePolicy.mjs";

const serviceId="litix-native-30day-campaign-pro";
const testBrief=Object.freeze({
 business:"Litix Native",audience:"independent local businesses",
 offer:"an original thirty-day content calendar",
 action:"View the catalog",platform:"Instagram"
});
/**
 * A production release flag alone cannot activate charges. Enforce the
 * independent release approval, merchant keys, Resend, DB and unit economics.
 */
export function nativeCheckoutConfigValid(env={}){
 if(env.VERCEL_ENV!=="production"||
    env.LITIX_NATIVE_PAID_ENABLED!=="true"||
    env.LITIX_NATIVE_RELEASE_APPROVAL!=="approved-native-pro30-v1")return false;
 for(const key of ["LITIX_NATIVE_DATABASE_URL","NMI_SECURITY_KEY","RESEND_API_KEY",
   "LITIX_NATIVE_ORDER_SECRET","LITIX_NATIVE_PRICES_JSON"]){
  if(typeof env[key]!=="string"||!env[key].trim())return false;
 }
 if(env.LITIX_NATIVE_ORDER_SECRET.length<32)return false;
 try{
  const q=nativePaidQuote({serviceId,brief:testBrief,env});
  return q.serviceId===serviceId&&q.priceCents>=300&&
   q.estimatedMarginCents>=Math.ceil(q.priceCents*.25);
 }catch{return false;}
}
/** Staging or production, read-only check; never creates a table or an order. */
export async function nativeCheckoutTablesPresent(sql){
 if(!sql||typeof sql.query!=="function")return false;
 try{
  const rows=await sql.query(
   "select to_regclass('public.litix_native_paid_orders') is not null as orders_ready, to_regclass('public.litix_native_email_outbox') is not null as outbox_ready",
   []);
  return rows.length===1&&rows[0].orders_ready===true&&rows[0].outbox_ready===true;
 }catch{return false;}
}
export async function nativeCheckoutReady(env,sql){
 if(!nativeCheckoutConfigValid(env))return false;
 return nativeCheckoutTablesPresent(sql);
}
