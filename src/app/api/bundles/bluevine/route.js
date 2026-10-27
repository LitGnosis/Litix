import {randomUUID,randomBytes} from "node:crypto";
import {growthBundle} from "../../../../lib/growthBundles.mjs";
import {normalizeOrderPhone,sendPendingOrderSms} from "../../../../lib/bundlePhone.mjs";
import {bluevineBundleLink} from "../../../../lib/bluevineBundles.mjs";
import {bundleBluevineReady} from "../route.js";
import {notifyBluevineOrderPending} from "../../../../lib/bluevineNotifications.mjs";
import {bundleDB,hashToken,response,sameOrigin} from "../../../../lib/bundleOrders.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// Records an UNPAID order before the customer leaves Litix.
// No payment confirmation is accepted from the browser or checkout return URL.
export async function POST(req){
 if(!sameOrigin(req))return response({error:"Origin verification failed"},403);
 if(!await bundleBluevineReady())return response({error:"Bluevine links are not yet verified or the pending-order database is not ready. No payment was initiated."},503);
 let data;
 try{const raw=await req.text();if(raw.length>3500)throw Error("oversized");data=JSON.parse(raw)}catch{return response({error:"Invalid order information"},400);}
 const pkg=growthBundle(data?.packageId);
 const checkoutUrl=bluevineBundleLink(pkg);
 const email=String(data?.email||"").trim().toLowerCase();
 const profile=String(data?.profile||"").trim();
 const phone=normalizeOrderPhone(data?.phone);
 const smsConsent=data?.smsConsent===true;
 const idem=String(data?.idempotencyKey||"").trim();
 if(!pkg||!checkoutUrl||data?.expectedAmountCents!==pkg.priceCents||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||
  !/^[\w.@:/-]{2,150}$/.test(profile)||
  !phone||!/^[a-f0-9-]{36}$/i.test(idem)||data?.whatsappConsent!==true)
  return response({error:"Enter a valid email, public account, international phone number, and agree to manual post submission"},422);
 const orderId="lbg_"+randomUUID();
 const secret=randomBytes(28).toString("base64url");
 let persistedOrder;
 try{
  const sql=bundleDB();
  const rows=await sql.query(
   "insert into litix_growth_bundle_orders(id,email,package_id,platform,package_name,price_cents,package_items,idempotency_key,tracking_token_hash,profile_ref,terms_accepted_at,payment_state,order_state,payment_provider,phone_e164,sms_consent_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,now(),'awaiting_payment','Awaiting Payment','bluevine',$11,case when $12::boolean then now() else null end) on conflict(idempotency_key) do nothing returning id,created_at",
   [orderId,email,pkg.id,pkg.platform,pkg.name,pkg.priceCents,JSON.stringify(pkg.items),idem,hashToken(secret),profile,phone,smsConsent]);
  if(!rows.length)return response({error:"This order has already been created. Use your saved tracking information; do not start another checkout."},409);
  persistedOrder=rows[0];
 }catch{return response({error:"Could not save pending Bluevine order. No redirect or payment initiated."},503);}
 // Sending failures must never change payment status or create an untracked charge.
 const notices=await notifyBluevineOrderPending({
  orderId,email,phone,profile,packageName:pkg.name,packageId:pkg.id,priceCents:pkg.priceCents,createdAt:persistedOrder.created_at,trackingToken:secret
 }).catch(()=>({owner:false,customer:false}));
 if(!notices.owner||!notices.customer)console.error("Bluevine pending order notifications need follow-up",{orderId,owner:notices.owner,customer:notices.customer});
 const sms=await sendPendingOrderSms({orderId,phone,bundleName:pkg.name,consented:smsConsent});
 return response({
  orderId,trackingToken:secret,checkoutUrl,
  pendingNotifications:{owner:!!notices.owner,customer:!!notices.customer,sms:!!sms.sent},
  payment:"awaiting_payment",status:"Awaiting Payment",
  message:"Your order was placed, but payment is AWAITING VERIFICATION. Complete Bluevine checkout, then send your receipt and up to 10 post links or screenshots through WhatsApp, email, or Instagram. LITIX will verify the transaction before fulfillment."
 },201);
}
