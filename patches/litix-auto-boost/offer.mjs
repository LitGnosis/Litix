// Litix Automatic customer offer. Price points verified from leofame.com/instagram-automatic-likes on 2026-10-19.
// These are quoted *retail* prices. Supplier costs and fulfillment must be validated before activation.
export const AUTO_LIKES_TIERS = Object.freeze([
  {likes:50, priceCents:400},
  {likes:100,priceCents:700},
  {likes:150,priceCents:1000},
  {likes:250,priceCents:1500},
  {likes:500,priceCents:2400},
  {likes:1000,priceCents:4000},
  {likes:2000,priceCents:7000},
]);
export const TERM_DAYS = 30;
export const MAX_POSTS_PER_DAY = 3;
export const DEFAULT_POST_LIMIT = TERM_DAYS * MAX_POSTS_PER_DAY;
export const VIDEO_VIEW_MULTIPLIER = 3;
export const OPTIONAL_METRICS = Object.freeze(['shares','reposts','saves']);
export const KNOWN_RETAIL_RATES_USD_PER_1000 = Object.freeze({
  // Snapshot only, NOT authoritative for the payment service. Source: production /api/services on 2026-10-19.
  shares: .0315, reposts: .7125, saves: 1.6035,
});
const whole = x => Number.isSafeInteger(x) && x >= 0 && x <= 1_000_000;
export function calculatePreviewQuote(input, rates=KNOWN_RETAIL_RATES_USD_PER_1000) {
  const likes=Number(input.likes), tier=AUTO_LIKES_TIERS.find(x=>x.likes===likes);
  if (!tier) throw new Error('Choose one of the listed automatic-likes packages.');
  const postLimit=Number(input.postLimit ?? DEFAULT_POST_LIMIT);
  if (!Number.isInteger(postLimit) || postLimit < 1 || postLimit > DEFAULT_POST_LIMIT) throw new Error('Post limit must be between 1 and 90.');
  let addonsCents=0;
  const addons={};
  for (const key of OPTIONAL_METRICS) {
    const qty=Number(input[key]??0);
    if(!whole(qty)) throw new Error(`${key} must be a non-negative whole number.`);
    if(qty===0){addons[key]={quantity:0,estimateCents:0};continue;}
    const rate=Number(rates[key]);
    if(!Number.isFinite(rate)||rate<0)throw new Error(`Live ${key} price unavailable. No order can be quoted.`);
    // Per-post rounding prevents total from underquoting very small add-on orders.
    const perPostCents=Math.ceil(qty * rate / 1000 * 100);
    const cost=perPostCents*postLimit;
    addonsCents+=cost;
    addons[key]={quantity:qty,estimateCents:cost};
  }
  return {likes,viewsForEligibleVideoPosts:likes*VIDEO_VIEW_MULTIPLIER,
    baseCents:tier.priceCents, addOnsEstimateCents:addonsCents,
    previewTotalCents:tier.priceCents+addonsCents,postLimit,addons,
    paymentReady:false, fulfillmentReady:false};
}
export const dollars = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
