import { NextResponse } from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const response=(payload,status=200)=>NextResponse.json(payload,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function POST(request){
  const expected=new URL(request.url).origin;
  if(request.headers.get("origin")!==expected)return response({error:"same_origin_required"},403);
  if(Number(request.headers.get("content-length")||"0")>8192)return response({error:"brief_too_large"},413);
  const base=process.env.LITIX_DIRECT_API_URL||"";
  const token=process.env.LITIX_INTERNAL_SERVICE_TOKEN||"";
  if(!/^https:\/\//.test(base)||token.length<32)return response({error:"applications_not_yet_enabled"},503);
  let data;try{data=await request.json()}catch{return response({error:"invalid_json"},400)}
  if(!["PANEL_149_WK","AGENCY_500_WK","ENTERPRISE_1500_WK"].includes(data?.tier)||
     typeof data?.owner_email!=="string"||data.owner_email.length>254)
    return response({error:"invalid_application"},422);
  try{
    const remote=await fetch(new URL("/v1/applications",base),{
      method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${token}`},
      body:JSON.stringify(data),cache:"no-store",signal:AbortSignal.timeout(12000),redirect:"error"
    });
    const json=await remote.json().catch(()=>({error:"invalid_backend_reply"}));
    return response(remote.ok?json:{error:json.detail||"enrollment_unavailable"},remote.status);
  }catch{return response({error:"enrollment_unavailable"},503)}
}
