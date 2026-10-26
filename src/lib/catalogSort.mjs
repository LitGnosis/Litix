// Presentation only. Numeric retail USD per 1,000, never minimum-order subtotals.
export function matchesServiceQuickKind(x,kind){
 if(!["likes","followers"].includes(kind))return true;
 const name=String(x?.name||"").toLowerCase();
 const category=String(x?.category||"").toLowerCase();
 const text=name+" "+category;
 if(kind==="likes")return /\blikes?\b/.test(text)&&!/\bfollowers?\b/.test(text)&&!/\b(?:views?|shares?|comments?|saves?|reposts?)\b/.test(name);
 return /\bfollowers?\b/.test(text)&&!/\blikes?\b/.test(name);
}
export function sortServicesPer1000(rows, platformRank, retailRate) {
  const tierOf = (service) => {
    const text = `${String(service?.category ?? "")} ${String(service?.name ?? "")}`;

    const isCorePlatform = /\b(?:instagram|tiktok|ig)\b/i.test(text);
    const isFollower = /\bfollowers?\b/i.test(text);
    const isLike = /\blikes?\b/i.test(text);
    const isBlended = /\b(?:impressions?|reach|visits?|shares?|reposts?|comments?|views?|saves?|plays?|clicks?|engagements?)\b/i.test(text);

    if (!isCorePlatform || isFollower === isLike || isBlended) return 3;

    const isAmerican = /🇺🇸|\b(?:american|us|usa|united states)\b/i.test(text);
    return isAmerican ? 1 : 2;
  };

  const priceOf = (service) => {
    const price = Number(retailRate(service));
    return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
  };

  return [...rows]
    .map((service, index) => ({ service, index, tier: tierOf(service), price: priceOf(service) }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.price !== b.price) return a.price < b.price ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ service }) => service);
}
