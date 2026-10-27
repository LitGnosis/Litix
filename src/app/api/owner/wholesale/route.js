import {ownerRequest,ownerResponse,safeOrigin} from "../../../../lib/ownerAuth.mjs";
import {ownerWholesaleCatalog} from "../../../../lib/ownerWholesale.mjs";
import {currentOwnerQuote,ownerOrderRows,ownerCreateOrder,ownerRefreshOrder,
 ownerPurchasesEnabled,ownerCardEnabled,ownerBalance} from "../../../../lib/ownerWholesaleOrders.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req){
 const session=ownerRequest(req);if(!session)return ownerResponse({error:"Owner Auth0 session required"},401);
 if(!safeOrigin(req))return ownerResponse({error:"Unexpected origin"},403);
 const type=new URL(req.url).searchParams.get("view")||"catalog";
 try{
  if(type==="catalog"){
   const v=await ownerWholesaleCatalog();
   return ownerResponse({...v,purchasesEnabled:ownerPurchasesEnabled(),cardEnabled:ownerCardEnabled(),
    cardPublicKey:ownerCardEnabled()?process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||null:null});
  }
  if(type==="orders")return ownerResponse({orders:await ownerOrderRows(session.sub)});
  if(type==="balances"){
   const settled=await Promise.allSettled(["smmglob","boostero"].map(async provider=>({provider,...await ownerBalance(provider)})));
   return ownerResponse({balances:settled.map((x,i)=>x.status==="fulfilled"?{...x.value,status:"available"}:{provider:["smmglob","boostero"][i],status:"unavailable"})});
  }
  return ownerResponse({error:"Unknown owner view"},400);
 }catch{return ownerResponse({error:"Private supplier data temporarily unavailable"},503)}
}
export async function POST(req){
 const session=ownerRequest(req);if(!session)return ownerResponse({error:"Owner Auth0 session required"},401);
 if(!safeOrigin(req)||req.headers.get("origin")!==new URL(req.url).origin)return ownerResponse({error:"Invalid origin"},403);
 let body;try{const raw=await req.text();if(raw.length>8000)return ownerResponse({error:"Oversized request"},413);body=JSON.parse(raw)}
 catch{return ownerResponse({error:"Invalid owner request"},400)}
 try{
  if(body?.action==="quote")return ownerResponse({quote:await currentOwnerQuote(body)});
  if(body?.action==="refresh"){
   if(!/^low_[0-9a-f-]{36}$/.test(String(body.orderId||"")))return ownerResponse({error:"Invalid order ID"},422);
   const order=await ownerRefreshOrder(session.sub,body.orderId);
   return ownerResponse({order});
  }
  if(body?.action==="purchase"){
   if(!ownerPurchasesEnabled())return ownerResponse({error:"Owner wholesale purchases are not activated"},503);
   const order=await ownerCreateOrder(session.sub,body);
   return ownerResponse(order,order.submitted?200:202);
  }
  return ownerResponse({error:"Unknown owner action"},400);
 }catch(e){
  const message=String(e.message||"Unknown error");
  // Only explicit validation failures are shown; never send provider payloads, secrets or stack traces.
  const safe=/^(invalid_|supplier_|owner_|duplicate_|final_owner_|collectjs_|gateway_|auth0_)/.test(message)||
    ["unavailable","order_not_found"].includes(message);
  return ownerResponse({error:safe?message:"Owner request could not be completed"},/duplicate|changed|already/.test(message)?409:422);
 }
}
