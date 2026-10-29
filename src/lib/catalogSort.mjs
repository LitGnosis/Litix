// Display ordering only; purchasability and Boostero fulfillment eligibility remain server-controlled.
const SOCIAL_ORDER = Object.freeze({
  "instagram followers": 0, "instagram likes": 1,
  "tiktok followers": 2, "tiktok likes": 3,
});
const textOf = x => [x?.name, x?.category, x?.description, x?.country, x?.region]
  .filter(Boolean).join(" ").toLowerCase();

export function matchesServiceQuickKind(x, kind) {
  if (!["likes", "followers"].includes(kind)) return true;
  const name = String(x?.name || "").toLowerCase();
  const text = name + " " + String(x?.category || "").toLowerCase();
  if (kind === "likes") return /\blikes?\b/.test(text) && !/\bfollowers?\b/.test(name) && !/\b(?:views?|shares?|comments?|saves?|reposts?)\b/.test(name);
  return /\bfollowers?\b/.test(text) && !/\blikes?\b/.test(name);
}
function socialPriority(x) {
  const label = textOf(x);
  const ig = /\b(?:instagram|ig)\b/.test(label);
  const tt = /\btik[\s._-]*tok\b/.test(label);
  const followers = /\bfollowers?\b/.test(label);
  const likes = /\blikes?\b/.test(label);
  if (ig && followers && !likes) return 0;
  if (ig && likes && !followers) return 1;
  if (tt && followers && !likes) return 2;
  if (tt && likes && !followers) return 3;
  return 99;
}
// Explicit USA labels first, global/standard or unqualified second,
// named country variants last. Geography is never guessed from supplier IDs.
function geographyPriority(x) {
  const label = textOf(x);
  if (/\b(?:usa|u\.?s\.?a?\.?|united states|american|us based|usa based)\b/.test(label)) return 0;
  if (/\b(?:global|worldwide|world wide|standard|international|all countries)\b/.test(label)) return 1;
  if (/\b(?:uk|united kingdom|canada|australia|germany|france|india|brazil|mexico|japan|korea|spain|italy|turkey|indonesia|philippines|pakistan|uae)\b/.test(label)) return 2;
  return 1;
}
export function sortServicesPer1000(rows, _platformRank, retailRate) {
  const priceOf = x => {
    const value = Number(retailRate(x));
    return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
  };
  return [...rows].map((service, index) => ({
    service, index, social: socialPriority(service),
    geo: geographyPriority(service), price: priceOf(service),
  })).sort((a, b) =>
    a.social - b.social ||
    (a.social === 99 ? 0 : a.geo - b.geo) ||
    a.price - b.price || a.index - b.index
  ).map(x => x.service);
}
