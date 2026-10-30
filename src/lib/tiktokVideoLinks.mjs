// Read-only TikTok link verification. Public user input never determines a fetch host.
// Short share links are resolved to one canonical TikTok video before checkout.
const approvedHosts = new Set(["tiktok.com","www.tiktok.com","m.tiktok.com","vm.tiktok.com","vt.tiktok.com"]);
export function inspectTikTokVideoLink(input){
  const raw=String(input??"").trim();
  if(!raw||raw.length>700)return null;
  let u;
  try{u=new URL(raw)}catch{return null}
  const host=u.hostname.toLowerCase();
  if(u.protocol!=="https:"||u.username||u.password||u.port||!approvedHosts.has(host))return null;
  const direct=u.pathname.match(/^\/@([A-Za-z0-9._]{2,24})\/video\/([0-9]{10,30})\/?$/);
  if(direct&&["tiktok.com","www.tiktok.com","m.tiktok.com"].includes(host))
    return {kind:"video",url:"https://www.tiktok.com/@"+direct[1]+"/video/"+direct[2]};
  const shortOnMain=["tiktok.com","www.tiktok.com","m.tiktok.com"].includes(host)
    && /^\/t\/[A-Za-z0-9_-]{5,80}\/?$/.test(u.pathname);
  const shortOnSub=["vm.tiktok.com","vt.tiktok.com"].includes(host)
    && /^\/[A-Za-z0-9_-]{5,80}\/?$/.test(u.pathname);
  return shortOnMain||shortOnSub?{kind:"short",url:u.origin+u.pathname}:null;
}
export async function resolveTikTokVideoLink(input,{fetcher=fetch}={}){
  let current=inspectTikTokVideoLink(input);
  if(!current)throw Error("Use a public TikTok video link or TikTok short share link.");
  if(current.kind==="video")return current.url;
  const signal=AbortSignal.timeout(14000);
  for(let hop=0;hop<6;hop++){
    let next=null;
    for(const method of ["HEAD","GET"]){
      let response;
      try{
        response=await fetcher(current.url,{
          method,redirect:"manual",cache:"no-store",signal,
          headers:{accept:"text/html"}
        });
      }catch{
        if(method==="HEAD")continue;
        throw Error("Unable to check this TikTok share link. Open the post and copy its full video link.");
      }
      if(method==="GET"&&response.body&&typeof response.body.cancel==="function")
        Promise.resolve(response.body.cancel()).catch(()=>{});
      const location=response.headers?.get("location");
      if(response.status>=300&&response.status<400&&location){
        let candidate;
        try{candidate=new URL(location,current.url)}catch{}
        next=candidate?inspectTikTokVideoLink(candidate.href):null;
        if(!next)throw Error("This TikTok share link does not lead to a supported public video.");
        break;
      }
      // Some TikTok short links redirect only for GET, not HEAD.
    }
    if(!next)throw Error("TikTok could not verify this share link. Open the video and copy its full link.");
    if(next.kind==="video")return next.url;
    if(next.url===current.url)break;
    current=next;
  }
  throw Error("TikTok share link redirected too many times. Use a full video URL.");
}
