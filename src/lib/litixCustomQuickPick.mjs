// Retail-only quick selection. These four are already enabled in Litix's
// approved service table. If an option disappears from the live catalog,
// fall back to another active option rather than inventing availability.
export const LITIX_CUSTOM_QUICK_PICKS=Object.freeze([
 Object.freeze({platform:"Instagram",kind:"followers",label:"Instagram Followers",preferredId:"litix_5461"}),
 Object.freeze({platform:"Instagram",kind:"likes",label:"Instagram Likes",preferredId:"litix_4751"}),
 Object.freeze({platform:"TikTok",kind:"followers",label:"TikTok Followers",preferredId:"litix_5101"}),
 Object.freeze({platform:"TikTok",kind:"likes",label:"TikTok Likes",preferredId:"litix_5251"})
]);
export function litixPreferredCustomService(items,platform,kind){
 const list=(Array.isArray(items)?items:[]).filter(s=>s?.purchasable===true&&
  s.platform===platform&&s.kind===kind&&/^litix_\d{1,12}$/.test(String(s.id||"")));
 if(!list.length)return null;
 const pref=LITIX_CUSTOM_QUICK_PICKS.find(x=>x.platform===platform&&x.kind===kind);
 const approved=list.find(s=>s.id===pref?.preferredId);
 // Preserve the existing catalog ordering (USA first, then regular).
 return approved||list[0];
}
