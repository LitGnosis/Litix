/**
 * Boostero full catalog proposed retail rates. The owner's latest NEW-SERVICE
 * pricing rule is 60% markup, with the separately required $5 per 1,000 and
 * $5 minimum transaction floors. Existing four approved prices are immutable.
 * This module quotes proposals only, never authorizes or captures a payment.
 */
const MAX_CENTS=1_000_000_000;
const moneyCents=amount=>{
 if(typeof amount!=="number"||!Number.isFinite(amount)||amount<0||amount>MAX_CENTS/100)return null;
 return Math.ceil(amount*100-1e-9);
};
export const NEW_SERVICE_MARKUP=1.6;
export const CUSTOMER_MINIMUM_CENTS=500;
export const NEW_RATE_FLOOR_CENTS_PER_1000=500;
export function proposeBoostero60RetailRate(wholesaleUsdPer1000,{existingApprovedRetailCents=null}={}){
 const wholesale=Number(wholesaleUsdPer1000);
 if(!Number.isFinite(wholesale)||wholesale<=0)return {valid:false,reason:"invalid_wholesale"};
 const proposed=Math.max(NEW_RATE_FLOOR_CENTS_PER_1000,moneyCents(wholesale*NEW_SERVICE_MARKUP)??0);
 if(!Number.isSafeInteger(proposed)||proposed>MAX_CENTS)return {valid:false,reason:"unbounded_retail"};
 if(existingApprovedRetailCents!==null){
  const saved=Number(existingApprovedRetailCents);
  if(!Number.isSafeInteger(saved)||saved<1)return {valid:false,reason:"existing_approved_price_invalid"};
  return {valid:true,preserved:true,retailPer1000Cents:saved,
   eligibleForAutomaticActivation:false,review:"existing_price_unchanged"};
 }
 return {valid:true,preserved:false,retailPer1000Cents:proposed,
  eligibleForAutomaticActivation:false,review:"new_service_approval_required"};
}
export function quoteBoostero60Order({wholesaleUsdPer1000,quantity,min,max,runs=1,existingApprovedRetailCents=null,orderType="Default"}={}){
 if(String(orderType).toLowerCase()!=="default")
  return {valid:false,reason:"fixed_package_or_recurring_billing_requires_distinct_quote"};
 const count=Number(quantity),minimum=Number(min),maximum=Number(max),batches=Number(runs);
 if(!Number.isSafeInteger(count)||!Number.isSafeInteger(minimum)||!Number.isSafeInteger(maximum)||
  count<minimum||count>maximum||count<1||maximum>1e9||
  !Number.isSafeInteger(batches)||batches<1||batches>100||count*batches>1e9)
  return {valid:false,reason:"supplier_quantity_out_of_bounds"};
 const price=proposeBoostero60RetailRate(wholesaleUsdPer1000,{existingApprovedRetailCents});
 if(!price.valid)return price;
 const totalUnits=count*batches,customerAmountCents=Math.ceil(totalUnits*price.retailPer1000Cents/1000-1e-9);
 const supplierCostCents=moneyCents(Number(wholesaleUsdPer1000)*totalUnits/1000);
 if(!Number.isSafeInteger(customerAmountCents)||!Number.isSafeInteger(supplierCostCents)||
    customerAmountCents>MAX_CENTS)return {valid:false,reason:"invalid_total"};
 if(customerAmountCents<CUSTOMER_MINIMUM_CENTS)return {
  valid:false,reason:"below_five_dollar_minimum",
  smallestEligibleQuantity:Math.max(minimum,Math.ceil(CUSTOMER_MINIMUM_CENTS*1000/(price.retailPer1000Cents*batches)))
 };
 if(existingApprovedRetailCents===null&&customerAmountCents<Math.ceil(supplierCostCents*NEW_SERVICE_MARKUP-1e-9))
  return {valid:false,reason:"below_sixty_percent_markup"};
 return {valid:true,quantity:count,runs:batches,totalUnits,customerAmountCents,
  retailPer1000Cents:price.retailPer1000Cents,preservedExistingPrice:price.preserved,
  // Internal-only: never spread supplierCostCents or wholesale onto public cards.
  supplierCostCents,eligibleForAutomaticActivation:false};
}
export function publicBoosteroRetailQuote(quote){
 if(!quote?.valid)return {available:false,reason:quote?.reason||"invalid_quote"};
 return {available:false,retailPer1000Cents:quote.retailPer1000Cents,
  customerAmountCents:quote.customerAmountCents,quantity:quote.quantity,
  requiresActivation:true,checkoutAuthorized:false};
}
