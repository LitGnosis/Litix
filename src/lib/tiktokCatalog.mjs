// Pure source catalog matcher. Never send supplier descriptions or costs to clients.
export const TIKTOK_EXACT_MATCH=Object.freeze({
 tiktok_followers:/^(?:NEW\s+)?TikTok Followers\s*\[\s*High Quality\s*\|\s*10K\s*\/\s*Day\b/i,
 tiktok_likes:/^(?:NEW\s+)?TikTok Likes\s*\[\s*Real Accounts\s*\|\s*5K\s*\/\s*Day\b/i,
 tiktok_views:/^TikTok Views\s*\[\s*Premium Quality\s*\|\s*100K\s*\/\s*Day\b/i,
 tiktok_comments:/^TikTok Random Comments\s*\[\s*Real Accounts\s*\|\s*500\s*\/\s*Day\b/i,
 tiktok_custom_comments:/^(?:NEW\s+)?TikTok Custom Comments\s*\[\s*High Quality\s*\|\s*5K\s*\/\s*Day\b/i,
 tiktok_shares:/^TikTok Shares\s*\[\s*High Quality\s*\|\s*10K\s*\/\s*Day\b/i,
 tiktok_saves:/^TikTok Saves\s*\[\s*High Quality\s*\|\s*10K\s*\/\s*Day\b/i,
 tiktok_story_views:/^(?:NEW\s+)?TikTok Story Views\s*\(All Stories\)\s*\[\s*High Quality\s*\|\s*10K\s*\/\s*Day\b/i
});
export const activeSupplierRow=row=>row&&
 /^\d{1,12}$/.test(String(row.service??""))&&
 String(row.type||"").toLowerCase()==="default"&&
 Number.isSafeInteger(Number(row.min))&&Number(row.min)>0&&
 Number.isSafeInteger(Number(row.max))&&Number(row.max)>=Number(row.min)&&
 Number(row.max)<=1000000&&Number.isFinite(Number(row.rate))&&Number(row.rate)>0;
export function tiktokSkuForService(row){
 const name=String(row?.name||"").trim(),category=String(row?.category||"").trim();
 if(!/\btiktok\b/i.test(name+" "+category))return null;
 const explicitKind=/\b(followers|likes|views|comments|shares|saves)\b/i.exec(name)?.[1]?.toLowerCase()||"";
 for(const [sku,pattern] of Object.entries(TIKTOK_EXACT_MATCH)){
  const kind=sku.replace(/^tiktok_/,"").replace(/^custom_/,"");
  if(explicitKind&&explicitKind!==kind)continue;
  if(pattern.test(name)||pattern.test(category))return sku;
 }
 return null;
}
export const strictTikTok35Service=row=>activeSupplierRow(row)&&
 ["tiktok_followers","tiktok_likes","tiktok_views","tiktok_comments",
  "tiktok_shares","tiktok_saves","tiktok_story_views"].includes(tiktokSkuForService(row));
export const curatedTikTokRateCents=wholesaleRate=>{
 const n=Number(wholesaleRate);
 if(!Number.isFinite(n)||n<=0||n>1000000)return null;
 return Math.ceil(n*1.35*100-1e-9);
};
export const curatedTikTokTotalCents=(retailRateCents,quantity)=>{
 if(!Number.isSafeInteger(retailRateCents)||retailRateCents<1||
  !Number.isSafeInteger(quantity)||quantity<1)return null;
 return Math.max(99,Math.round(quantity*retailRateCents/1000));
};
export const tiktokTierLabel=sku=>({
 tiktok_followers:"High Quality · Up to 10,000/day",
 tiktok_likes:"Premium Active Profiles · Up to 5,000/day",
 tiktok_views:"Premium Quality · Up to 100,000/day",
 tiktok_comments:"Premium Active Profiles · Up to 500/day",
 tiktok_shares:"High Quality · Up to 10,000/day",
 tiktok_saves:"High Quality · Up to 10,000/day",
 tiktok_story_views:"All Stories · Up to 10,000/day"
}[sku]||"");
export function resolveExactTikTokServices(raw){
 const found={};
 for(const row of Array.isArray(raw)?raw:[]){
  const sku=tiktokSkuForService(row);
  if(!sku||!activeSupplierRow(row))continue;
  if(!found[sku]||Number(row.rate)<Number(found[sku].rate))found[sku]=row;
 }
 return found;
}
