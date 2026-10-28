// Shared, supplier-neutral classifier for the four Boostero-only storefront categories.
// Preserve all other categories, including services mentioning a word only in broad supplier category metadata.
const platformOf=label=>/\btik[\s-]*tok\b/i.test(label)?"tiktok":/\binstagram\b|\big\b/i.test(label)?"instagram":null;
export function restrictedSocialKind(service){
 const title=String(service?.name||""),category=String(service?.category||"");
 const platform=platformOf(title+" "+category);
 if(!platform)return null;
 const followers=/\bfollowers?\b/i.test(title)||(/\bfollowers?\b/i.test(category)&&!/\b(?:views?|likes?|comments?|shares?|saves?)\b/i.test(title));
 const likes=/\blikes?\b/i.test(title)&&!/\b(?:comment|story|livestream|live stream|live|poll|battle|reply|replies)\b/i.test(title);
 if(followers&&likes)return null; // ambiguous service; never remap
 if(followers)return platform+" followers";
 if(likes)return platform+" likes";
 return null;
}
export const publicBoosteroOnlyEnabled=()=>process.env.VERCEL_ENV==="production"&&process.env.LITIX_BOOSTERO_ENABLED==="true";
export function isBoosteroOnlyRestrictedService(service){
 return restrictedSocialKind(service)!==null;
}
export function legacyPublicServiceAllowed(service){
 return !publicBoosteroOnlyEnabled()||!isBoosteroOnlyRestrictedService(service);
}
