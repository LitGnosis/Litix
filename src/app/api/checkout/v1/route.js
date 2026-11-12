import {POST as ownedDollarCheckout} from "../pilot/route.js";
import {handleBoosteroOrder} from "../../../../lib/boosteroOrderHandler.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(request){
 let data;
 try{data=await request.clone().json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
 if(data?.product==="website_preview"){
  if(data.serviceId!=null||data.link!=null||data.postAllocations!=null||
     data.serviceKind!=null||data.amountCents!==100)
   return Response.json({error:"product_mismatch",chargeAttempted:false},{status:422});
  const headers=new Headers(request.headers);headers.delete("content-length");
  return ownedDollarCheckout(new Request(request.url,{method:"POST",headers,body:JSON.stringify(data)}));
 }
 if(request.headers.get("origin")!==new URL(request.url).origin)
  return Response.json({error:"same_origin_required",chargeAttempted:false},{status:403});
 const id=String(data?.serviceId||"");
 if(!/^(?:litix|boostero)_[0-9]{1,12}$/.test(id)){
  // No retired supplier fallback, no card or supplier request.
  return Response.json({error:"Only available Litix services can be purchased. No charge attempted."},{status:409});
 }
 const body={...data,serviceId:id.split("_")[1],destination:data?.link,action:"card_purchase"};
 const url=new URL(request.url);
 return handleBoosteroOrder(new Request(url,{method:"POST",headers:{"content-type":"application/json",
   ...(request.headers.get("origin")?{"origin":request.headers.get("origin")}:{})},
   body:JSON.stringify(body)}),{adminOnly:false});
}
