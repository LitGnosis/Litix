import {GET as smmTracking} from "../[action]/route.js";
import {GET as boosteroTracking} from "../internal/boostero/track/route.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request){
 const query=new URL(request.url);
 const id=query.searchParams.get("id")||"",token=query.searchParams.get("token")||"";
 if(process.env.VERCEL_ENV==="production"&&/^ltx2_[a-f0-9-]{36}$/.test(id)&&token.length>=25){
  try{
   const url=new URL(request.url);url.searchParams.set("order",id);
   const r=await boosteroTracking(new Request(url,request));
   if(r.ok){
    const payload=await r.json(),x=payload.order;
    return Response.json({order:{id:x.id,service:x.service,quantity:Number(x.quantity),
     amount:(Number(x.amountCents)/100).toFixed(2),payment:x.payment,fulfillment:x.fulfillment,
     supplierOrderId:x.supplierOrderId,status:x.supplierStatus,checkedAt:x.lastChecked,
     deliveryConfirmed:x.fulfillment==="COMPLETED",liveSupplierStatus:false,
     statusNote:"Latest saved Boostero supplier status; delivery is not guaranteed."}},
     {headers:{"cache-control":"no-store","referrer-policy":"no-referrer"}});
   }
  }catch{}
 }
 // Every SMMGLOB tracking request retains its previous handler, unchanged.
 const url=new URL(request.url);url.pathname="/api/track";
 return smmTracking(new Request(url,request));
}
