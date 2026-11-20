import {STATIC_CURATED_PREVIEW} from "./curatedStaticPreview.mjs";

export const DEFAULT_CURATED_SKU="curated_instagram_followers_standard";

export function initialCuratedOffer(requested=DEFAULT_CURATED_SKU){
 const id=String(requested||"");
 return STATIC_CURATED_PREVIEW.find(item=>item.id===id)||
  STATIC_CURATED_PREVIEW.find(item=>item.id===DEFAULT_CURATED_SKU)||null;
}

export function curatedPresetQuantity(service,requested=service?.kind==="followers"?100:1000){
 const amount=Number(requested);
 if(Number.isSafeInteger(amount)&&amount>=Number(service?.min)&&amount<=Number(service?.max))
  return amount;
 return service?.kind==="followers"?Number(service?.min||100):Number(service?.min)>1000?Number(service.min):1000;
}

export function formatCuratedUnitRange(min,max){
 const first=Number(min),last=Number(max);
 if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first<1||last<first)
  return "Live limits checked before payment";
 return first.toLocaleString("en-US")+"–"+last.toLocaleString("en-US")+" units";
}
