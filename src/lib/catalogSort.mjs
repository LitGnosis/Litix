// Presentation only. Numeric retail USD per 1,000, never minimum-order subtotals.
export function matchesServiceQuickKind(x,kind){
 if(!["likes","followers"].includes(kind))return true;
 const name=String(x?.name||"").toLowerCase();
 const category=String(x?.category||"").toLowerCase();
 const text=name+" "+category;
 if(kind==="likes")return /\blikes?\b/.test(text)&&!/\bfollowers?\b/.test(text)&&!/\b(?:views?|shares?|comments?|saves?|reposts?)\b/.test(name);
 return /\bfollowers?\b/.test(text)&&!/\blikes?\b/.test(name);
}
// Display ordering only: the four currently approved social categories first,
// followed by all other products. Keep server-side supplier and purchase
// eligibility rules separate; sorting does not approve or reveal a service.
export function sortServicesPer1000(rows, _platformRank, retailRate) {
  const categoryPriority = {
    "instagram followers": 0,
    "instagram likes": 1,
    "tiktok followers": 2,
    "tiktok likes": 3,
  };
  const priorityOf = (service) => {
    const category = String(service?.category ?? "").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(categoryPriority, category)) {
      return categoryPriority[category];
    }

    // Retain backwards compatibility for approved services whose category
    // is broader than their name. Do not promote blended views, shares, etc.
    const title = String(service?.name ?? "");
    const text = category + " " + title;
    const instagram = /\b(?:instagram|ig)\b/i.test(text);
    const tiktok = /\btik[\s-]*tok\b/i.test(text);
    const followers = /\bfollowers?\b/i.test(text);
    const likes = /\blikes?\b/i.test(text);
    const blended = /\b(?:impressions?|reach|visits?|shares?|reposts?|comments?|views?|saves?|plays?|clicks?|engagements?|stories?|livestreams?)\b/i.test(title);

    if (instagram === tiktok || followers === likes || blended) return 4;
    if (instagram) return followers ? 0 : 1;
    return followers ? 2 : 3;
  };
  // Geography is display priority only; no supplier eligibility is inferred.
  const geoOf = (service) => {
    const label=[service?.name,service?.category,service?.country,service?.region,service?.location,service?.geo]
      .map(x=>String(x??"")).join(" ").toLowerCase();
    const foreign=/\b(?:canada|canadian|uk|united kingdom|british|india|indian|brazil|brazilian|mexico|mexican|france|french|germany|german|italy|italian|australia|australian|philippines|filipino|pakistan|pakistani|indonesia|indonesian|turkey|turkish|spain|spanish|vietnam|vietnamese|japan|japanese|korea|korean|nigeria|nigerian|uae|emirates|saudi|russia|russian|egypt|egyptian|africa|europe|asia)\b/.test(label);
    const usa=/\b(?:american|usa|united states|u\.?s\.?a?\.?|us[- ]based)\b|🇺🇸/.test(label);
    if(foreign)return 2;
    if(usa)return 0;
    return 1; // Global/regular/standard and unlabeled services.
  };
  const priceOf = (service) => {
    const price = Number(retailRate(service));
    return Number.isFinite(price) && price >= 0 ? price : Number.POSITIVE_INFINITY;
  };

  return [...rows]
    .map((service, index) => ({
      service, index, priority: priorityOf(service), geo: geoOf(service), price: priceOf(service),
    }))
    .sort((a, b) =>
      a.priority - b.priority ||
      (a.priority < 4 ? a.geo - b.geo : 0) ||
      (a.price < b.price ? -1 : a.price > b.price ? 1 : 0) ||
      a.index - b.index
    )
    .map(({ service }) => service);
}
