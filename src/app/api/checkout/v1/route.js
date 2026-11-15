import {POST as ownedDollarCheckout} from "../pilot/route.js";
import {handleBoosteroOrder} from "../../../../lib/boosteroOrderHandler.mjs";
import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
import {parseCuratedId,resolveCuratedSupplier} from "../../../../lib/curatedCatalog.mjs";
import {boosteroDestination} from "../../../../lib/boosteroFulfillment.mjs";
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
 // One-time payment route cannot silently accept an unavailable subscription add-on.
 // Recurring billing and future-post delivery have a separate release gate.
 if(data?.autoLikes===true||data?.auto_likes===true||data?.autoLikes30Days===true||
    data?.recurring===true||data?.subscription===true||
    (Array.isArray(data?.addons)&&data.addons.some(v=>/auto.?likes|recurring/i.test(String(v)))))
  return Response.json({error:"Recurring Auto-Likes is not currently available. No payment attempted.",chargeAttempted:false},{status:409});
 const id=String(data?.serviceId||"");
 const curated=parseCuratedId(id);
 if(curated&&!["followers","likes","views","comments","shares","saves"].includes(curated.kind))
  return Response.json({error:"This package requires a different delivery format and is not available in quick checkout.",chargeAttempted:false},{status:409});
 if(!curated&&!/^(?:litix|boostero)_[0-9]{1,12}$/.test(id)){
  // No retired supplier fallback, no card or supplier request.
  return Response.json({error:"Only available Litix services can be purchased. No charge attempted."},{status:409});
 }
 let supplierId=id.split("_")[1];
 if(curated){
  try{
   const rows=await boosteroProduction("services");
   const current=resolveCuratedSupplier(rows,curated.platform,curated.kind,curated.tier);
   if(!current||!/^[0-9]{1,12}$/.test(String(current.service)))
    return Response.json({error:"This package is temporarily unavailable. No payment attempted.",chargeAttempted:false},{status:409});
   // Profile services must use public profiles; engagement needs a matching
   // public post/video URL, not an unrelated social media URL.
   const kind=curated.kind,platform=curated.platform.toLowerCase();
   const strictKind=kind==="followers"?"followers":"likes";
   const normalized=boosteroDestination(data?.link,platform,strictKind);
   if(!normalized)
    return Response.json({error:"Enter the correct public profile or post URL for this service. No payment attempted.",chargeAttempted:false},{status:422});
   supplierId=String(current.service);
   data={...data,link:normalized};
  }catch{
   return Response.json({error:"The selected service cannot be verified right now. No payment attempted.",chargeAttempted:false},{status:503});
  }
 }
 const body={...data,serviceId:supplierId,destination:data?.link,action:"card_purchase"};
 const url=new URL(request.url);
 const result=await handleBoosteroOrder(new Request(url,{method:"POST",headers:{"content-type":"application/json",
   ...(request.headers.get("origin")?{"origin":request.headers.get("origin")}:{})},
   body:JSON.stringify(body)}),{adminOnly:false});
 if(!curated||result.status<400)return result;
 try{
  const payload=await result.json();
  if(typeof payload.error!=="string")return Response.json(payload,{status:result.status});
  const clean=payload.error.replace(/\bBoostero(?:'s)?\b/gi,"Litix");
  return Response.json({...payload,error:clean},{status:result.status,
   headers:{"cache-control":"no-store","referrer-policy":"no-referrer"}});
 }catch{
  return Response.json({error:"Secure checkout is temporarily unavailable",chargeAttempted:false},
   {status:503,headers:{"cache-control":"no-store"}});
 }
}
