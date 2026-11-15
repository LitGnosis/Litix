export const CORE_PLATFORMS=Object.freeze(["Instagram","TikTok"]);
export const CORE_KINDS=Object.freeze(["followers","likes","views","comments"]);
export const CORE_QUANTITIES=Object.freeze([100,250,500,1000,2500,5000]);
export const TIKTOK_EXTRA_KINDS=Object.freeze([
 {kind:"shares",label:"Shares"},{kind:"saves",label:"Saves"},
 {kind:"story_views",label:"Story Views"},{kind:"auto_likes",label:"Auto Likes"},
 {kind:"auto_views",label:"Auto Views"}
]);
export const CURATED_SERVICES=Object.freeze(Object.fromEntries(
 CORE_PLATFORMS.flatMap(platform=>CORE_KINDS.map(kind=>[
  platform.toLowerCase()+"_"+kind,
  Object.freeze({sku:platform.toLowerCase()+"_"+kind,platform,kind,
   name:kind[0].toUpperCase()+kind.slice(1)})
 ]))
));
export const isCuratedSku=sku=>Object.hasOwn(CURATED_SERVICES,String(sku||""));
