/**
 * Independent Litix supply: authoritative, fail-closed capability registry.
 *
 * This is NOT the Boostero catalog or a third-party SMM reseller.
 * It distinguishes Litix-owned digital files, a staged premium file, and
 * verified creator/publisher inventory. It does not create orders, change
 * existing checkout, reserve slots, pay a publisher or claim social metrics.
 *
 * NEVER expose partner identities, rate cards, contract IDs or source proofs
 * through the public capability API. Never sell a campaign from an unverified
 * application or a "likes/followers" quantity.
 */
import {litixNativeServices} from "./litixNativeSupplier.mjs";
import {NATIVE_PREMIUM_PRODUCTS} from "./litixNativePremiumAssets.mjs";

export const NATIVE_SUPPLY_KINDS=Object.freeze([
 "original_content_package","sponsored_creator_content",
 "publisher_newsletter_placement","publisher_site_placement",
 "managed_ad_campaign","original_campaign_report"
]);
export const NATIVE_SUPPLY_CHANNELS=Object.freeze([
 "instagram","tiktok","youtube","x","facebook","linkedin",
 "website","newsletter","search","other"
]);
const bounded=(x,max)=>typeof x==="string"?x.trim().slice(0,max):"";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const iso=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const money=x=>Number.isSafeInteger(x)&&x>=0&&x<=1_000_000;
const isTruthy=x=>x===true;
const idRegex=/^litix-placement-[a-z0-9-]{8,60}$/;
const platformRules=new Set(NATIVE_SUPPLY_CHANNELS);
const typeRules=new Set(NATIVE_SUPPLY_KINDS);

/** Validate a single reviewed, genuine placement/creative offer. */
export function verifyNativeSupplyOffer(offer,{now=new Date()}={}){
 const reasons=[];
 if(!offer||typeof offer!=="object"||Array.isArray(offer))
  return {approved:false,reasons:["INVALID_OFFER"],publicOffer:null};
 const id=bounded(offer.id,90),kind=bounded(offer.kind,80);
 const title=bounded(offer.title,120),channel=bounded(offer.channel,30);
 const regions=Array.isArray(offer.regions)?offer.regions:[];
 if(!idRegex.test(id)||!typeRules.has(kind)||!platformRules.has(channel)||
   title.length<8||title.length>100)reasons.push("INVALID_CLASSIFICATION");
 if(!Array.isArray(offer.regions)||regions.length<1||regions.length>15||
   regions.some(x=>typeof x!=="string"||!/^[A-Z]{2}$/.test(x)))
  reasons.push("INVALID_REGIONS");
 if(!uuid.test(String(offer.partnerId||""))||!uuid.test(String(offer.contractId||"")))
  reasons.push("UNVERIFIED_OWNER");
 if(offer.status!=="APPROVED"||!isTruthy(offer.contractSigned)||
    !isTruthy(offer.identityVerified)||!isTruthy(offer.rightsVerified)||
    !isTruthy(offer.platformPolicyReviewed)||!isTruthy(offer.adDisclosureRequired))
  reasons.push("COMPLIANCE_UNVERIFIED");
 if(!iso(offer.reviewedAt)||!iso(offer.validUntil))
  reasons.push("REVIEW_DATES_MISSING");
 else{
  const reviewed=Date.parse(offer.reviewedAt),expires=Date.parse(offer.validUntil);
  const nowMs=new Date(now).getTime();
  if(!Number.isFinite(nowMs)||reviewed>nowMs||nowMs-reviewed>90*86400000||
     expires<=nowMs||expires-reviewed>366*86400000)
   reasons.push("STALE_OR_EXPIRED");
 }
 if(!Number.isSafeInteger(offer.remainingSlots)||offer.remainingSlots<1||
    offer.remainingSlots>1000)reasons.push("NO_VERIFIED_CAPACITY");
 if(!Number.isInteger(offer.minimumLeadDays)||offer.minimumLeadDays<1||
    offer.minimumLeadDays>180)reasons.push("INVALID_LEAD_TIME");
 if(!money(offer.retailPriceCents)||!money(offer.creatorCostCents)||
   !money(offer.supportReserveCents)||!money(offer.mediaBudgetCents))
  reasons.push("INVALID_UNIT_ECONOMICS");
 else{
  const price=offer.retailPriceCents;
  const cogs=offer.creatorCostCents+offer.supportReserveCents+offer.mediaBudgetCents;
  const gatewayFee=Math.ceil(price*0.035)+30;
  if(price<500||cogs+gatewayFee+Math.ceil(price*.25)>price)
   reasons.push("UNPROFITABLE_OR_UNAPPROVED");
 }
 if(offer.guaranteesFollowers===true||offer.guaranteesLikes===true||
    offer.guaranteesViews===true||offer.incentivizesEngagement===true)
  reasons.push("METRIC_MANIPULATION");
 if(reasons.length)return {approved:false,reasons,publicOffer:null};
 return {approved:true,reasons:[],publicOffer:Object.freeze({
  id,title,kind,channel,regions:regions.slice(),
  availableSlots:offer.remainingSlots,
  leadDays:offer.minimumLeadDays,
  currency:"USD",indicativePriceCents:offer.retailPriceCents,
  delivery:"Genuine contracted creative or sponsored placement",
  guaranteesEngagement:false,
  bookingEnabled:false,
  // A valid supply contract does not establish automatic checkout or an
  // authenticated/settled customer campaign booking flow.
  eligibility:"OPERATOR_REVIEW_REQUIRED"
 })};
}

/**
 * Intentionally separate from the live SMM catalog. A supplier name or
 * category is never treated as native delivery capacity.
 */
export function legacyServiceNativeStatus(service={}){
 const label=[service?.name,service?.category,service?.type].map(x=>String(x??"")).join(" ").toLowerCase();
 if(/\b(followers?|likes?|views?|retweets?|subscribers?|engagement|comments?|auto[\s-]?likes?)\b/.test(label))
  return {nativeFulfillmentReady:false,reason:"NO_OWNED_AUTHENTIC_ENGAGEMENT_CAPACITY"};
 return {nativeFulfillmentReady:false,reason:"NOT_VERIFIED_AS_NATIVE_PRODUCT"};
}

/**
 * Public presentation exposes no secrets. A potentially verified capacity
 * entry is informational ONLY until actual bookings have a safe reservation
 * and settled-payment workflow; no direct sale or order will be accepted.
 */
export function litixNativeSupplySnapshot({env={},now=new Date()}={}){
 const owned=litixNativeServices().map(x=>({
  id:x.id,title:x.name,method:"LITIX_GENERATED",
  previewAvailable:true,paidCheckoutEnabled:false,
  supplierRequired:false
 }));
 const futurePaid=NATIVE_PREMIUM_PRODUCTS.map(x=>({
  id:x.id,title:x.name,method:"LITIX_GENERATED",
  previewAvailable:false,paidCheckoutEnabled:false,
  supplierRequired:false,status:"PENDING_COMMERCIAL_RELEASE"
 }));
 let records=[];
 if(typeof env.LITIX_NATIVE_VERIFIED_CAPACITY_JSON==="string"){
  try{
   const parsed=JSON.parse(env.LITIX_NATIVE_VERIFIED_CAPACITY_JSON);
   if(Array.isArray(parsed?.offers)&&parsed.offers.length<=200)records=parsed.offers;
  }catch{/* invalid configuration is empty capacity, not permission */}
 }
 const reviewed=records.map(x=>verifyNativeSupplyOffer(x,{now}));
 const approved=reviewed.filter(x=>x.approved).map(x=>x.publicOffer);
 const available=env.LITIX_NATIVE_INVENTORY_VISIBILITY_ENABLED==="true"?approved:[];
 return Object.freeze({
  supplier:"Litix Native",
  apiVersion:"v1",
  independenceMode:"FIRST_PARTY_CAPACITY_GATED",
  ownedFreeServices:owned,
  ownedPremiumServices:futurePaid,
  verifiablePlacementCount:available.length,
  publisherPlacements:available,
  canAcceptPlacementOrders:false,
  paidCheckoutEnabled:false,
  wholesaleOrderingEnabled:false,
  legacySocialMetricsNativeFulfillment:false,
  activeVerifiedSupplyWithoutPaymentFlow:false,
  // Not exposed: rejected records, identity, costs, contracts and review notes.
  outstandingRequirements:[
   "verified publisher/creator capacity and signed agreement",
   "reservable slots and scoped wholesale customer authorization",
   "approved paid checkout with settled-payment confirmation",
   "delivery evidence, dispute process and creator payout accounting"
  ]
 });
}
