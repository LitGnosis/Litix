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
 instagram:"e.g. @username or https://instagram.com/username",
 tiktok:"e.g. @username or https://tiktok.com/@username",
 youtube:"e.g. @channel or https://youtube.com/@channel",
 facebook:"e.g. @page or https://facebook.com/page",
 x:"e.g. @username or https://x.com/username"
}[platform]||"e.g. https://example.com/public-profile");

export function checkoutTargetPlaceholder(service){
 const profile=profilePlatformForService(service);
 if(profile)return checkoutProfilePlaceholder(profile);
 switch(String(service?.platform||"").toLowerCase()){
  case "instagram":return "e.g. https://instagram.com/p/AbCd123/ or /reel/...";
  case "tiktok":return "e.g. https://tiktok.com/@creator/video/1234567890123456789";
  case "youtube":return "e.g. https://youtube.com/watch?v=abcdefghijk";
  case "facebook":return "e.g. https://facebook.com/page/posts/12345";
  case "twitter (x)":
  case "x":return "e.g. https://x.com/creator/status/123456789012";
  default:return "e.g. a full HTTPS link to your public post or profile";
 }
}
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

// Browser guidance only; fulfillment and payment routes independently validate
// the destination against the exact current service requirements.
export function validateLitixCheckoutTarget(value,service){
 const raw=String(value||"").trim();
 if(!raw)return {ok:false,message:"Paste a public profile or post link to continue."};
 if(!service)return {ok:false,message:"Select a service to verify the link format."};
 const platform=String(service.platform||"").toLowerCase();
 const kind=String(service.kind||"").toLowerCase();
 const profile=profilePlatformForService(service);
 if(profile){
  const p=normalizeProfileDestination(raw,profile);
  return p.ok?{ok:true,url:p.url,message:"Public profile or channel format looks valid."}:
   {ok:false,message:p.error||"Enter the direct public profile URL."};
 }
 let url;
 try{url=new URL(raw)}catch{return {ok:false,message:"Paste the full HTTPS post or video URL."}}
 const host=url.hostname.toLowerCase().replace(/^www\./,"");
 if(url.protocol!=="https:"||url.username||url.password||url.port||
    host==="localhost"||!host.includes(".")||/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host))
  return {ok:false,message:"Use a secure public link with no login information."};
 const pathname=url.pathname,segments=pathname.split("/").filter(Boolean);
 let valid=true,message="Public link format looks valid.";
 if(platform==="instagram"){
  valid=host==="instagram.com"&&
    /^\/(?:p|reel|tv)\/[a-zA-Z0-9_-]{5,40}\/?$/.test(pathname);
  message="Instagram Likes and Views require a public post or reel URL (/p/ or /reel/).";
 }else if(platform==="tiktok"){
  valid=["tiktok.com","vm.tiktok.com","vt.tiktok.com"].includes(host)&&(
    /^\/@[A-Za-z0-9._]{2,24}\/video\/\d{10,30}\/?$/.test(pathname)||
    (/^(?:vm|vt)\.tiktok\.com$/.test(host)&&segments.length>=1));
  message="Paste a public TikTok video URL or short Share link.";
 }else if(platform==="youtube"){
  valid=["youtube.com","youtu.be","m.youtube.com"].includes(host)&&(
    (/^\/(?:shorts|live)\/[A-Za-z0-9_-]{7,30}\/?$/.test(pathname))||
    (pathname==="/watch"&&/^[A-Za-z0-9_-]{7,30}$/.test(url.searchParams.get("v")||""))||
    (host==="youtu.be"&&/^\/[A-Za-z0-9_-]{7,30}\/?$/.test(pathname)));
  message="Use a public YouTube video, Shorts, live or watch link.";
 }else if(platform==="twitter (x)"||platform==="x"){
  valid=["x.com","twitter.com"].includes(host)&&
    /^\/[A-Za-z0-9_]{1,15}\/status\/\d{5,30}\/?$/.test(pathname);
  message="Use the public X post URL containing /status/.";
 }else if(platform==="facebook"){
  valid=["facebook.com","m.facebook.com","fb.watch"].includes(host)&&
    (segments.length>0||pathname==="/watch"&&url.searchParams.has("v"));
  message="Use a public Facebook page, post, reel or video link.";
 }
 return valid?{ok:true,url:url.toString(),message:"Link format looks valid for "+service.platform+" "+(kind||"service")+". Verification occurs before payment."}:
  {ok:false,message};
}
