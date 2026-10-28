const truth=v=>v===true||String(v).toLowerCase()==="true"||String(v)==="1";
const hasRefill=x=>truth(x.refill)||truth(x.refillable)||truth(x.auto_refill)||truth(x.autorefill);
/**
 * Litix global supplier-cost and Instagram/TikTok followers/views price rules.
 * Adapted from the supplied pricing ZIP; used by catalog and checkout.
 *
 * "700% markup" means 700% markup ON TOP of cost (8x cost).
 * User's explicit bracket examples take precedence at the cutoffs:
 *    wholesale under $1 => at least 8x
 *    $1 <= wholesale < $20 => at least 5x (exact $1 => at least $5)
 *    wholesale >= $20 => regular retail targets 2x (exact $20 => $40)
 * This applies to EVERY sold service, not only IG/TikTok followers/views.
 * Units matter: supplier's actual order wholesale versus customer's subtotal,
 * and separate per-1000 wholesale versus per-1000 catalog prices.
 * Products that cannot satisfy every rule MUST NOT be sold.
 */
const RETAIL_USD_PER_1000 = Object.freeze({
  none: 6.99,
  '7': 7.49,
  '15': 7.99,
  '30': 8.99,
  '60': 10.49,
  '90': 11.99,
  '120': 12.99,
  '180': 13.99,
  '270': 14.49,
  '365': 18.99,
  lifetime: 22.99,
});

const SORTED_TIERS = Object.freeze([
  'none','7','15','30','60','90','120','180','270','365','lifetime',
]);
const MAX_NON_PREMIUM_PER_1000_CENTS = 1500;
const MIN_INSTAGRAM_TIKTOK_PER_1000_CENTS = 600;
const MIN_GLOBAL_PER_1000_CENTS = 500;
const MIN_PURCHASE_CENTS = 500;

function cents(usd) {
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd < 0) return null;
  // ROUND UP, not nearest cent: no fractional-cent underpricing.
  return Math.ceil(usd * 100 - 1e-8);
}

/**
 * Apply to supplier wholesale *in the same pricing unit* as the retail value.
 * This function is also run against the actual TOTAL supplier cost for every
 * order, accounting for quantity, discounts, and any supplier surcharges.
 */
function minimumRetailCentsForWholesale(wholesaleUsd) {
  if (typeof wholesaleUsd !== 'number' || !Number.isFinite(wholesaleUsd) || wholesaleUsd < 0) {
    return null;
  }
  const multiplier = wholesaleUsd < 1 ? 8 : wholesaleUsd < 20 ? 5 : 2;
  return cents(wholesaleUsd * multiplier);
}

function wholesaleMultiplier(wholesaleUsd) {
  if (typeof wholesaleUsd !== 'number' || !Number.isFinite(wholesaleUsd) || wholesaleUsd < 0) return null;
  return wholesaleUsd < 1 ? 8 : wholesaleUsd < 20 ? 5 : 2;
}

/**
 * All other products (likes, comments, shares, YouTube, Spotify, Facebook, etc.)
 * For wholesale < $20: keep the existing retail price if high enough,
 * otherwise raise to the minimum requested markup.
 * For wholesale >= $20: set ordinary catalog retail to exactly 2x wholesale,
 * as the user's example requires ($20 cost => $40 sale); do not preserve an
 * earlier arbitrary, higher retail price for normal products.
 * IG/TikTok Followers/Views are exceptional: use proposeServiceRetail so the
 * refill ladder and min/max constraints are still enforced.
 * Wholesale and retail MUST have matching units, e.g. both per 1k or both/order.
 */
function proposeGeneralRetail(wholesaleUsd, existingRetailUsd) {
  const floor = minimumRetailCentsForWholesale(wholesaleUsd);
  const current = cents(existingRetailUsd);
  if (floor === null) return { action: 'review', reason: 'verified supplier wholesale is missing' };
  if (current === null) return { action: 'review', reason: 'existing retail price is missing' };
  // Never reduce a previously higher retail price, even when wholesale >= $20.
  const updated = Math.max(current, floor, MIN_GLOBAL_PER_1000_CENTS);
  return {
    action: updated === current ? 'unchanged' : 'reprice',
    retailCents: updated,
    retailUsd: updated / 100,
    wholesaleCentsFloor: floor,
    multiplier: wholesaleMultiplier(wholesaleUsd),
  };
}

function classifyService(service) {
  const label = [service?.name ?? '', service?.category ?? ''].join(' ');
  const platform = /\btik[\s-]?tok\b/i.test(label) ? 'tiktok'
    : /\binstagram\b|\big\b/i.test(label) ? 'instagram' : null;
  const kind = /\bfollowers?\b/i.test(label) ? 'followers'
    : /\bviews?\b/i.test(label) ? 'views' : null;
  if (!platform || !kind) return { inScope: false, platform, kind, tier: null };

  if (/\b(no|without|non)[\s-]*refills?\b/i.test(label))
    return { inScope: true, platform, kind, tier: 'none' };

  const hasRefill = service?.refill === true || /\brefills?\b/i.test(label);
  const durations=[...label.matchAll(/\b(\d+)\s*[- ]?\s*(?:days?|d)\b/gi)].map(m=>m[1]);
  if (/\blife[ -]?time\b/i.test(label))
    return { inScope: true, platform, kind, tier: hasRefill && !durations.length ? 'lifetime' : 'unknown' };
  if(new Set(durations).size>1 || durations.some(d=>!SORTED_TIERS.includes(d))) return {inScope:true,platform,kind,tier:'unknown'};
  const days = label.match(/\b(7|15|30|60|90|120|180|270|365)\s*[- ]?\s*(?:days?|d)\b/i);
  if (days) return { inScope: true, platform, kind, tier: hasRefill ? days[1] : 'unknown' };

  return { inScope: true, platform, kind, tier: hasRefill ? 'unknown' : 'none' };
}

/**
 * For IG and TikTok Followers/Views, keep the published tier ladder as a target,
 * BUT increase its rate when needed for the user's wholesale floor or a more
 * expensive comparable shorter-refill option. Exclude if the $15 cap is broken.
 *
 * The second argument is verified ACTUAL WHOLESALE PER 1,000, never an existing
 * markup/retail `per1000` field. Caller must group only truly comparable
 * variants by platform + product + targeting + quality/speed + other features.
 */
function proposeServiceRetail(service, supplierWholesalePer1000, {
  precedingTierRetailCents = null,
} = {}) {
  const classification = classifyService(service);
  if (!classification.inScope) return { action: 'unchanged', classification, note: 'use proposeGeneralRetail for global floor' };
  const { tier } = classification;
  if (!(tier in RETAIL_USD_PER_1000))
    return { action: 'review', reason: 'refill duration/guarantee not verified', classification };

  const floor = minimumRetailCentsForWholesale(supplierWholesalePer1000);
  if (floor === null)
    return { action: 'review', reason: 'actual SMMGLOB supplier wholesale not verified', classification };

  if (precedingTierRetailCents !== null &&
      (!Number.isSafeInteger(precedingTierRetailCents) || precedingTierRetailCents < 0))
    throw Error('precedingTierRetailCents must be a valid amount in cents or null');

  const target = cents(RETAIL_USD_PER_1000[tier]);
  const result = Math.max(target, floor, MIN_GLOBAL_PER_1000_CENTS,
    precedingTierRetailCents === null ? 0 : precedingTierRetailCents + 1);
  if (result < MIN_INSTAGRAM_TIKTOK_PER_1000_CENTS ||
      (!['365', 'lifetime'].includes(tier) && result > MAX_NON_PREMIUM_PER_1000_CENTS)) {
    return {
      action: 'exclude',
      reason: 'supplier-cost multiplier or longer-refill price cannot fit the $6–$15 cap',
      classification, requiredRetailPer1000: result / 100,
      wholesaleFloorPer1000: floor / 100,
    };
  }
  return {
    action: 'reprice', classification,
    retailPer1000: result / 100, retailPer1000Cents: result,
    wholesaleFloorPer1000: floor / 100,
    multiplier: wholesaleMultiplier(supplierWholesalePer1000),
  };
}

/**
 * Quote-price check for *every* sold service. Call on the server before payment,
 * with the actual supplier cost at the order quantity (NOT just a 1k estimate).
 * The final customer subtotal must be >= appropriate multiplier * wholesale
 * total (8x below $1, 5x $1 through $19.999.., 2x $20 and above) and must
 * match the displayed quote after quantity scaling and discounts. A blocked
 * quote must not call PayKings or create a supplier order.
 */
function validateCheckoutQuote({
  actualSupplierWholesaleUsd, customerSubtotalCents,
  displayedPer1000 = null, quantity = null, service = null,
}) {
  const floor = minimumRetailCentsForWholesale(actualSupplierWholesaleUsd);
  if (floor === null) return { allowed: false, reason: 'actual order wholesale not verified' };
  if (!Number.isSafeInteger(customerSubtotalCents) || customerSubtotalCents < 0)
    return { allowed: false, reason: 'customer subtotal invalid' };
  if (customerSubtotalCents < MIN_PURCHASE_CENTS)
    return { allowed: false, reason: 'minimum service purchase is $5 USD', requiredSubtotalCents: MIN_PURCHASE_CENTS };
  if (customerSubtotalCents < floor)
    return { allowed: false, reason: 'customer charge below required supplier markup', requiredSubtotalCents: floor };

  if (displayedPer1000 !== null) {
    const displayCents = cents(displayedPer1000);
    if (displayCents === null || !Number.isSafeInteger(quantity) || quantity <= 0)
      return { allowed: false, reason: 'invalid quoted quantity/per-1000 rate' };
    const expected = calculateOrderCents(quantity, displayedPer1000);
    if (expected !== customerSubtotalCents)
      return { allowed: false, reason: 'customer subtotal disagrees with advertised quote' };
    const scope = classifyService(service);
    if (displayCents < MIN_GLOBAL_PER_1000_CENTS)
      return { allowed: false, reason: 'retail rate below $5 per 1,000 units' };
    if (scope.inScope && (displayCents < 600 ||
        (scope.tier !== '365' && scope.tier !== 'lifetime' && displayCents > 1500)))
      return { allowed: false, reason: 'IG/TikTok follower/view pricing band violated' };
    if (scope.inScope && scope.tier === 'unknown')
      return { allowed: false, reason: 'unverified refill guarantee' };
  }
  return { allowed: true, requiredSubtotalCents: floor };
}

/**
 * Minimum legal supplier quantity at which retail charges at least $5,
 * without an arbitrary surcharge or changed supplier min/max.
 */
function minimumPurchaseQuantity(service, per1000) {
  const min=Number(service?.min),max=Number(service?.max);
  const rawStep=service?.quantity_step??service?.quantityStep??service?.step??service?.increment??1;
  const step=Number(rawStep);
  if(!Number.isSafeInteger(min)||min<=0||!Number.isSafeInteger(max)||max<min||
     !Number.isSafeInteger(step)||step<1||!Number.isFinite(per1000)||per1000<5)return null;
  const threshold=Math.max(min,Math.ceil((MIN_PURCHASE_CENTS*10)/per1000-1e-10));
  const n=min+Math.max(0,Math.ceil((threshold-min)/step))*step;
  if(!Number.isSafeInteger(n)||n>max||calculateOrderCents(n,per1000)<MIN_PURCHASE_CENTS)return null;
  return n;
}
function servicePurchaseMinimum(service,per1000) {
  const quantity=minimumPurchaseQuantity(service,per1000);
  return quantity===null?null:{quantity,amountCents:calculateOrderCents(quantity,per1000)};
}
function calculateOrderCents(quantity, retailPer1000) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0)
    throw Error('quantity must be a positive safe integer');
  if (typeof retailPer1000 !== 'number' || !Number.isFinite(retailPer1000) || retailPer1000 <= 0)
    throw Error('retailPer1000 must be a finite positive number');
  return Math.max(1, Math.ceil((quantity * retailPer1000 / 1000) * 100 - 1e-8));
}

function validatePriceLadder() {
  const vals = SORTED_TIERS.map(tier => RETAIL_USD_PER_1000[tier]);
  if (!vals.every((v, i) => Number.isFinite(v) && v >= 6 &&
    (i === 0 || v > vals[i-1])))
    throw Error('Expected strictly increasing tier ladder with $6 floor');
  for (const tier of SORTED_TIERS.filter(t => !['365','lifetime'].includes(t))) {
    if (RETAIL_USD_PER_1000[tier] > 15) throw Error(`Non-premium tier ${tier} exceeds $15`);
  }
  return true;
}
validatePriceLadder();

// Supplier metadata determines pricing; client-provided labels never set markup.
const retailMultiplier=x=>{const label=[x.name,x.category].map(v=>String(v||"" )).join(" ");return /\btik[\s-]?tok\b/i.test(label)&&/\blikes?\b/i.test(label)?9:5;};
// These service-specific profits are USD per 1,000 above the live wholesale rate.
// Equivalent markup percentage = profit / wholesale × 100; bypass the general discount.
const profitPer1000=Object.freeze({"33677":10,"33516":5,"33337":7.5,"33338":7.5});
const baseRetailPer1000=x=>{
 const profit=profitPer1000[String(x.service)];
 if(profit!==undefined)return Number(x.rate)+profit;
 const rate=Number(x.rate)*retailMultiplier(x);return rate>30?rate*0.65:rate;
};
// Only supplier response fields establish wholesale and refill guarantees.
const supplierPricingInput=x=>({...x,refill:hasRefill(x),
 name:[x.name,x.description,x.desc,x.notes,x.terms].filter(Boolean).join(" ")});
const pricingDecision=x=>{
 const rate=Number(x.rate);
 if(!Number.isFinite(rate)||rate<=0)return {action:"review",reason:"verified wholesale missing"};
 const input=supplierPricingInput(x),scope=classifyService(input);
 return scope.inScope?proposeServiceRetail(input,rate):proposeGeneralRetail(rate,baseRetailPer1000(x));
};
const familyOf=x=>JSON.stringify([
 ...[x.name,x.category,x.description,x.desc,x.notes,x.terms].map(v=>String(v||"").toLowerCase()
 .replace(/\b(?:no|without|non)[ -]*refills?\b/g,"")
 .replace(/\b(?:7|15|30|60|90|120|180|270|365)\s*[- ]?\s*(?:days?|d)\b|\blife[ -]?time\b/g,"").replace(/\brefills?\b/g,"").replace(/\s+/g," ").trim()),
 x.type,x.min,x.max,x.country,x.region,x.location,x.geo,x.audience,x.target]);
const coverageOf=x=>{
 const scope=classifyService(supplierPricingInput(x));if(scope.inScope)return scope.tier;
 const label=[x.name,x.category,x.description,x.desc,x.notes,x.terms].filter(Boolean).join(" ");
 if(/\b(?:no|without|non)[ -]*refills?\b/i.test(label))return "none";
 if(!hasRefill(x)&&!/\brefills?\b/i.test(label))return "none";
 const days=[...label.matchAll(/\b(\d+)\s*[- ]?\s*(?:days?|d)\b/gi)].map(m=>m[1]);
 if(new Set(days).size>1)return "unknown";
 if(/\blife[ -]?time\b/i.test(label))return days.length?"unknown":"lifetime";
 return days.length===1&&SORTED_TIERS.includes(days[0])?days[0]:"unknown";
};
function priceCatalog(rows){
 const groups=new Map(),allowed=[],excluded=[];
 for(const x of rows){const d=pricingDecision(x);if(!["reprice","unchanged"].includes(d.action)){
 excluded.push({id:String(x.service),reason:d.reason});continue;}
 const item={...x,pricedRetail:d.retailPer1000??d.retailUsd};
 if(coverageOf(x)!=="unknown"){const k=familyOf(x);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);}else allowed.push(item);}
 for(const items of groups.values()){
 items.sort((a,b)=>SORTED_TIERS.indexOf(coverageOf(a))-SORTED_TIERS.indexOf(coverageOf(b)));
 let previous=null,lastTier=null,tierMax=null;
 for(const x of items){const tier=coverageOf(x);
 if(tier!==lastTier){previous=tierMax??previous;lastTier=tier;}
 let d;
 if(classifyService(supplierPricingInput(x)).inScope)d=proposeServiceRetail(supplierPricingInput(x),Number(x.rate),{precedingTierRetailCents:previous});
 else {
 const current=Math.round(x.pricedRetail*100),next=Math.max(current,previous===null?0:previous+1);
 d=Number(x.rate)>=20&&next!==current?{action:"exclude",reason:"exact 2x wholesale conflicts with longer-refill ordering"}:{action:"reprice",retailPer1000:next/100,retailPer1000Cents:next};
 }
 if(d.action!=="reprice"){excluded.push({id:String(x.service),reason:d.reason});continue;}
 x.pricedRetail=d.retailPer1000;tierMax=Math.max(tierMax??0,d.retailPer1000Cents);allowed.push(x);
 }}
 return {items:allowed,excluded};
}
const retailPer1000=x=>x.pricedRetail;

export { MIN_GLOBAL_PER_1000_CENTS, MIN_PURCHASE_CENTS, minimumPurchaseQuantity, servicePurchaseMinimum, RETAIL_USD_PER_1000, SORTED_TIERS, classifyService, minimumRetailCentsForWholesale, wholesaleMultiplier, proposeGeneralRetail, proposeServiceRetail, calculateOrderCents, validateCheckoutQuote, validatePriceLadder, priceCatalog, pricingDecision, retailPer1000, supplierPricingInput };
