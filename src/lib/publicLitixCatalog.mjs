// Customer catalog DTO. Supplier routing, wholesale economics, approval sources,
 // and internal supplier SKU prefixes must never be serialized to public pages.
import {publicServiceCardName,litixCustomerServiceName} from "./serviceCardDisplay.mjs";
const valid=/^(?:boostero|litix)_([0-9]{1,12})$/;
export const litixPublicId=value=>{
 const match=valid.exec(String(value||""));
 return match?"litix_"+match[1]:null;
};
export const litixInternalId=value=>{
 const match=valid.exec(String(value||""));
 return match?"boostero_"+match[1]:null;
};
export const litixPublicCard=item=>{
 const id=litixPublicId(item?.id);
 if(!id)return null;
 return {
  id,
  name:publicServiceCardName(item),
  category:litixCustomerServiceName(item.category||"Litix services"),
  platform:item.platform,
  kind:item.kind,
  min:item.min,
  max:item.max,
  unitStep:item.unitStep||1,
  type:item.type==="Default"?"Standard":item.type,
  per1000:item.per1000,
  startingAmountCents:item.startingAmountCents,
  purchasable:item.purchasable===true,
  pricingReview:item.pricingReview===true,
  refill:item.refill===true
 };
};
