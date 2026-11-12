// Shared X custom navigation. Discovery never overrides the server-side checkout eligibility check.
export const customPlatformFromQuery = value => {
 const v=String(value||"").trim().toLowerCase();
 if(v==="x"||v==="twitter"||v==="twitter (x)")return "Twitter (X)";
 if(v==="instagram")return "Instagram";
 if(v==="tiktok")return "TikTok";
 return null;
};
export const quickShopCustomHref = platform => {
 if(platform==="X"||platform==="Twitter (X)")return "/custom-likes?platform=x&kind=followers";
 if(platform==="TikTok")return "/custom-likes?platform=tiktok";
 return "/custom-likes?platform=instagram";
};
export function eligibleXFollowers(items){
 return (Array.isArray(items)?items:[]).filter(s=>
  s?.platform==="Twitter (X)"&&s.kind==="followers"&&s.purchasable===true&&
  /^litix_\d{1,12}$/.test(String(s.id||""))&&
  Number.isFinite(Number(s.per1000))&&Number(s.per1000)>0&&
  Number.isSafeInteger(Number(s.min))&&Number(s.min)>0&&
  Number.isSafeInteger(Number(s.max))&&Number(s.max)>=Number(s.min)) ;
}
export function preferredXFollowers(items){
 const options=eligibleXFollowers(items);
 return options.find(s=>/\b(?:usa|american|united states)\b/i.test(s.name)&&!/\bnft\b/i.test(s.name))||
  options.find(s=>!/\bnft\b/i.test(s.name))||options[0]||null;
}
