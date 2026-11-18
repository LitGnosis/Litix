import {boosteroProductionReady,boosteroQuote} from "../../../../../lib/boosteroFulfillment.mjs";
import {curatedRetailQuote} from "../../../../../lib/curatedVolumePricing.mjs";
import {parseCuratedId,curatedSupplierSnapshot,resolveCuratedSupplier} from "../../../../../lib/curatedCatalog.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=12;
const headers={"cache-control":"no-store","x-content-type-options":"nosniff"};
const reply=(data,status=200)=>Response.json(data,{status,headers});

// Read-only live price for quantities outside the preset cards.
// Never writes a payment ledger, tokenizes a card or places a supplier order.
export async function GET(request){
 const params=new URL(request.url).searchParams;
 const serviceId=params.get("serviceId")||"";
 const id=parseCuratedId(serviceId);
 const quantity=Number(params.get("quantity"));
 if(!id||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)
  return reply({error:"Invalid service or quantity",ready:false,chargeAttempted:false},422);
 if(!boosteroProductionReady())
  return reply({error:"Live pricing temporarily unavailable",ready:false,chargeAttempted:false},503);
 try{
  const supplier=resolveCuratedSupplier(await curatedSupplierSnapshot(),id.platform,id.kind,id.tier);
  if(!supplier)return reply({error:"Service currently unavailable",ready:false,chargeAttempted:false},409);
  const q=curatedRetailQuote(boosteroQuote({service:supplier,quantity}));
  return reply({ready:true,serviceId,quantity,totalCents:q.amountCents,
   volumeDiscountPercent:q.volumeDiscountPercent,currency:"USD",chargeAttempted:false});
 }catch{
  return reply({error:"Live price or supplier quantity limit unavailable",
   ready:false,chargeAttempted:false},409);
 }
}
