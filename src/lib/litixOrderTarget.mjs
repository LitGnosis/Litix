// Shared destination validation for the Litix quick checkout.
// Followers/subscribers use a public profile/page, not a post URL.
// Likes, views, comments, shares, etc retain the existing post-link flow.
const hostFor=Object.freeze({
 instagram:["instagram.com"],tiktok:["tiktok.com"],
 youtube:["youtube.com"],facebook:["facebook.com"],
 x:["x.com","twitter.com"]
});
const usernamePattern={
 instagram:/^[A-Za-z0-9._]{1,30}$/,
 tiktok:/^[A-Za-z0-9._]{2,24}$/,
 youtube:/^[A-Za-z0-9._-]{3,50}$/,
 facebook:/^[A-Za-z0-9._-]{2,80}$/,
 x:/^[A-Za-z0-9_]{1,15}$/
};
const prefix={
 instagram:"https://www.instagram.com/",
 tiktok:"https://www.tiktok.com/@",youtube:"https://www.youtube.com/@",
 facebook:"https://www.facebook.com/",x:"https://x.com/"
};
export function profilePlatformForService(service){
 if(!["followers","subscribers"].includes(String(service?.kind||"").toLowerCase()))return "";
 const platform=String(service?.platform||"").toLowerCase();
 if(platform==="instagram")return "instagram";
 if(platform==="tiktok")return "tiktok";
 if(platform==="youtube")return "youtube";
 if(platform==="facebook")return "facebook";
 if(platform==="twitter (x)"||platform==="x")return "x";
 return "";
}
export const checkoutProfileLabel=platform=>({
 instagram:"Instagram username or profile link",
 tiktok:"TikTok username or profile link",
 youtube:"YouTube channel name or link",
 facebook:"Facebook page name or link",
 x:"X username or profile link"
}[platform]||"Public page or profile URL");
export const checkoutProfilePlaceholder=platform=>({
 instagram:"@username or instagram.com/username",
 tiktok:"@username or tiktok.com/@username",
 youtube:"@channel or youtube.com/@channel",
 facebook:"@page or facebook.com/page",
 x:"@username or x.com/username"
}[platform]||"https://...");
export function normalizeProfileDestination(value,platform){
 const raw=String(value||"").trim();
 if(!platform)return {ok:true,value:raw};
 if(!hostFor[platform])return {ok:false,error:"Choose a supported public profile."};
 if(!raw)return {ok:false,error:"Enter a public "+platform+" username or profile link."};
 let input=raw;
 if(new RegExp("^(?:www\\.)?(?:"+hostFor[platform].join("|").replaceAll(".","\\.")+")\\/","i").test(raw))
  input="https://"+raw;
 if(/^https?:\/\//i.test(input)){
  let u;try{u=new URL(input)}catch{return {ok:false,error:"Enter a valid public profile link."}}
  const host=u.hostname.toLowerCase().replace(/^www\./,"");
  if(u.protocol!=="https:"||u.username||u.password||!hostFor[platform].includes(host))
   return {ok:false,error:"Use a secure "+platform+" profile link, not another website."};
  const path=u.pathname;
  let valid=false,username="";
  if(platform==="instagram"){const m=path.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);if(m){valid=true;username=m[1]}}
  if(platform==="tiktok"){const m=path.match(/^\/@([A-Za-z0-9._]{2,24})\/?$/);if(m){valid=true;username=m[1]}}
  if(platform==="x"){const m=path.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);if(m){valid=true;username=m[1]}}
  if(platform==="youtube"){valid=/^\/(?:@[A-Za-z0-9._-]{3,50}|channel\/[A-Za-z0-9_-]{8,80}|c\/[A-Za-z0-9._-]{3,80}|user\/[A-Za-z0-9._-]{3,80})\/?$/.test(path)}
  if(platform==="facebook"){valid=/^\/[A-Za-z0-9._-]{2,80}\/?$/.test(path)||
    (path==="/profile.php"&&/^\d{3,30}$/.test(u.searchParams.get("id")||""))}
  if(!valid)return {ok:false,error:"Enter a direct public profile, page, or channel link."};
  if(username)return {ok:true,url:prefix[platform]+username+(platform==="instagram"?"/":"")};
  return {ok:true,url:u.origin+u.pathname+(platform==="facebook"&&path==="/profile.php"?"?id="+u.searchParams.get("id"):"")};
 }
 const username=raw.replace(/^@/,"");
 if(!usernamePattern[platform].test(username))return {ok:false,error:"Enter a valid "+platform+" username or direct profile link."};
 return {ok:true,url:prefix[platform]+username+(platform==="instagram"?"/":"")};
}
