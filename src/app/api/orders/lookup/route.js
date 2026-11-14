import {POST as existingLookup} from "../../order-lookup/route.js";
import {secureTrackUrl} from "../../../../lib/litixFulfillmentSecurity.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
export async function POST(request){
 const cloned=request.clone();
 let body;
 try{body=await cloned.json()}catch{return Response.json({error:"Invalid request"},{status:400})}
 const orderId=String(body?.orderId||"").trim();
 const email=String(body?.email||"").trim().toLowerCase();
 if(!/^ltx2_[a-f0-9-]{36}$/.test(orderId)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  return Response.json({error:"Enter your complete Litix order number and checkout email."},{status:400});
 const headers=new Headers(request.headers);
 headers.delete("content-length");
 const response=await existingLookup(new Request(request.url,{method:"POST",headers,
  body:JSON.stringify({orderId,email})}));
 if(!response.ok)return response;
 const result=await response.json();
 if(!result?.order)return Response.json({error:"Tracking not found"},{status:404});
 let url;
 try{url=secureTrackUrl(result.order.id)}catch{
  return Response.json({order:result.order},{headers:{"cache-control":"no-store"}});
 }
 return Response.json({...result,privateTrackingLink:url},{headers:{"cache-control":"no-store","referrer-policy":"no-referrer"}});
}
