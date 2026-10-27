import {instagramUsername,canonicalPostURL} from "../../../../lib/choosePosts.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const out=(v,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function GET(request){
 const username=instagramUsername(new URL(request.url).searchParams.get("username"));
 if(!username)return out({error:"Enter a valid Instagram username."},400);
 const caller=process.env.LITIX_META_IG_USER_ID,token=process.env.LITIX_META_ACCESS_TOKEN;
 const fallback={username,available:false,posts:[],message:"Photo grid unavailable for this account. Paste public Instagram post links below."};
 if(!caller||!token)return out(fallback);
 if(!/^\d{5,30}$/.test(caller))return out(fallback);
 try{
  const fields="business_discovery.username("+username+"){username,media.limit(24){id,media_type,media_url,thumbnail_url,permalink,timestamp}}";
  const api=new URL("https://graph.facebook.com/v26.0/"+caller);
  api.searchParams.set("fields",fields);
  api.searchParams.set("access_token",token);
  const response=await fetch(api,{cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!response.ok)return out(fallback);
  const data=(await response.json())?.business_discovery;
  if(!data||String(data.username||"").toLowerCase()!==username.toLowerCase())return out(fallback);
  const posts=(data.media?.data||[]).slice(0,24).map(m=>{
   const link=canonicalPostURL(m.permalink);
   const thumbnail=String(m.thumbnail_url||m.media_url||"");
   let acceptable=false;
   try{const u=new URL(thumbnail);acceptable=u.protocol==="https:"&&!u.username&&!u.password;}catch{}
   return link&&acceptable?{url:link,thumbnail,mediaType:String(m.media_type||"PHOTO")} : null;
  }).filter(Boolean);
  return out({username,available:posts.length>0,posts,message:posts.length?"Select the public posts you want to boost.":fallback.message});
 }catch{return out(fallback);}
}
