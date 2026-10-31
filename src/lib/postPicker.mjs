// Shared, dependency-free validation for Litix's visual post selector.
// No provider secrets or external requests belong in this module.
const IG_HANDLE=/^[A-Za-z0-9._]{1,30}$/;
const TT_HANDLE=/^[A-Za-z0-9._]{2,24}$/;

export function normalizeProfile(platform,input){
  if(!["instagram","tiktok"].includes(platform))return null;
  let value=String(input??"").trim();
  if(!value||value.length>250)return null;
  if(/^https?:\/\//i.test(value)){
    let u;
    try{u=new URL(value)}catch{return null}
    if(u.protocol!=="https:"||u.username||u.password)return null;
    const valid=platform==="instagram"?["instagram.com","www.instagram.com"]:["tiktok.com","www.tiktok.com","m.tiktok.com"];
    if(!valid.includes(u.hostname.toLowerCase()))return null;
    const match=platform==="instagram"?u.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/):u.pathname.match(/^\/@([A-Za-z0-9._]{2,24})\/?$/);
    if(!match)return null;
    value=match[1];
  }else value=value.replace(/^@/,"");
  const rule=platform==="instagram"?IG_HANDLE:TT_HANDLE;
  if(!rule.test(value)||value.startsWith(".")||value.endsWith(".")||value.includes(".."))return null;
  return value.toLowerCase();
}

export function canonicalPost(platform,url){
  try{
    const u=new URL(String(url??""));
    if(u.protocol!=="https:"||u.username||u.password)return null;
    if(platform==="instagram"){
      if(!["www.instagram.com","instagram.com"].includes(u.hostname.toLowerCase()))return null;
      const m=u.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]{5,40})\/?$/);
      return m?"https://www.instagram.com/"+m[1]+"/"+m[2]+"/":null;
    }
    if(platform==="tiktok"){
      if(!["www.tiktok.com","tiktok.com","m.tiktok.com"].includes(u.hostname.toLowerCase()))return null;
      const m=u.pathname.match(/^\/@([A-Za-z0-9._]{2,24})\/(video|photo)\/([0-9]{10,25})\/?$/);
      return m?"https://www.tiktok.com/@"+m[1]+"/"+m[2]+"/"+m[3]:null;
    }
  }catch{}
  return null;
}

function validThumbnail(value){
  try{
    const u=new URL(String(value??""));
    return u.protocol==="https:"&&!u.username&&!u.password?u.toString():null;
  }catch{return null}
}

export function normalizePosts(platform,handle,rows){
  if(!Array.isArray(rows))return [];
  const out=[],seen=new Set();
  for(const row of rows){
    if(!row||typeof row!=="object")continue;
    if(row.status&&["ERROR","PRIVATE_PROFILE","NOT_FOUND","BLOCKED"].includes(String(row.status).toUpperCase()))continue;
    const owner=platform==="instagram"?row.owner?.username:row.channel?.username;
    if(owner&&String(owner).toLowerCase()!==handle)continue;
    const url=canonicalPost(platform,platform==="instagram"?row.url:row.postPage);
    if(!url||seen.has(url))continue;
    const thumbnail=validThumbnail(platform==="instagram"?(row.media?.thumbnailUrl||row.media?.displayUrl):(row.video?.thumbnail||row.video?.cover||row.images?.[0]));
    if(!thumbnail)continue;
    seen.add(url);
    out.push({id:url,url,thumbnail,kind:platform==="instagram"?String(row.mediaType||"post"):String(row.images?.length?"photo":"video"),caption:String(row.caption||row.title||"").slice(0,180)});
    if(out.length>=24)break;
  }
  return out;
}

export function divideLikes(total,count,minimum=1){
  if(!Number.isSafeInteger(total)||!Number.isSafeInteger(count)||count<1||count>8||!Number.isSafeInteger(minimum)||minimum<1||total<count*minimum)return null;
  const base=Math.floor(total/count),rem=total%count;
  return Array.from({length:count},(_,i)=>base+(i<rem?1:0));
}
