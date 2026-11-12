import {resolveTikTokVideoLink} from "../../../../lib/tiktokVideoLinks.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=20;
export async function POST(request){
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)
    return Response.json({error:"Invalid origin"},{status:403});
  let body;
  try{
    const raw=await request.text();
    if(raw.length>1400)return Response.json({error:"Link too long"},{status:413});
    body=JSON.parse(raw);
  }catch{return Response.json({error:"Invalid link request"},{status:400})}
  try{
    const url=await resolveTikTokVideoLink(body?.link);
    return Response.json({ok:true,url},{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  }catch(error){
    return Response.json({ok:false,error:String(error?.message||"Could not verify TikTok link").slice(0,180)},
      {status:422,headers:{"cache-control":"no-store"}});
  }
}
