/** Public read-only listing from Litix's own signed-node and settlement gates. */
export const runtime="nodejs";
export const dynamic="force-dynamic";
const send=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store"}});
export async function GET(){
 const base=process.env.LITIX_DIRECT_API_URL||"";
 const token=process.env.LITIX_INTERNAL_SERVICE_TOKEN||"";
 const unavailable={supplier:"Litix-owned only",services:[],checkoutReady:false,
   currency:"USD",externalSupplierCalls:0};
 if(!/^https:\/\//.test(base)||token.length<32)return send(unavailable);
 try{
   const response=await fetch(new URL("/v1/internal/retail/catalog",base),{
     headers:{"authorization":`Bearer ${token}`},cache:"no-store",
     redirect:"error",signal:AbortSignal.timeout(9000)});
   if(!response.ok)return send(unavailable);
   const data=await response.json();
   const ready=data.checkoutReady===true && Array.isArray(data.services) && data.services.length>0;
   const services=ready?data.services.filter(x=>
     x.serviceKind==="creative_kit"&&Number.isSafeInteger(x.priceCents)&&x.priceCents>=100):[];
   return send({supplier:"Litix-owned only",services,checkoutReady:ready&&services.length>0,
     currency:"USD",externalSupplierCalls:0,
     publicCollectKey:ready&&services.length>0
       ?(process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY||"")
       :""});
 }catch{return send(unavailable)}
}
