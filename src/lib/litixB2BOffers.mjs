// Commercial proposal guides, not live products or guaranteed recurring contracts.
// These are suggested price ranges for discovery conversations. Never use as checkout prices.
export const LITIX_B2B_OFFERS=Object.freeze([
 Object.freeze({
  id:"lead-response",
  name:"AI-Assisted Lead Response Operations",
  price:"Proposed $1,500–$3,000 per month",
  pricingNote:"Setup, software licenses and third-party messaging fees quoted separately where applicable",
  audience:"Appointment-based businesses and small agencies",
  outcome:"Organize consent-based inquiries and reduce missed follow-up opportunities.",
  scope:Object.freeze(["Review one existing lead intake path and booking workflow","Configure only approved notifications and one-time acknowledgements","Define human escalation and response ownership","Agree on one monthly operational report"]),
  limits:"No autonomous selling, guaranteed bookings, fabricated reviews, or contact harvesting"
 }),
 Object.freeze({
  id:"marketing-ops",
  name:"Business Marketing Operations",
  price:"Proposed $2,000–$4,000 per month",
  pricingNote:"Media spend, creative production, additional channels and software licenses priced separately",
  audience:"Established businesses and content teams",
  outcome:"Establish a consistent, reviewed marketing workflow with accountable reporting.",
  scope:Object.freeze(["Audit existing goals and authorized channels","Scope a reviewed content and distribution calendar","Set up permitted campaign tracking where account access allows","Review inquiry and conversion measures monthly"]),
  limits:"No promised search rankings, social engagement, sales, or advertising performance"
 }),
 Object.freeze({
  id:"agency-integration",
  name:"Agency Workflow & API Integration Pilot",
  price:"Proposed $1,500–$5,000 per defined project",
  pricingNote:"Optional support is quoted only after the pilot is accepted",
  audience:"Marketing agencies and service businesses",
  outcome:"Implement one carefully scoped operational integration with testing and handover.",
  scope:Object.freeze(["Document one workflow and integration requirements","Confirm permissions, platform APIs and test environment","Develop and verify approved workflow steps","Deliver handover notes and acceptance criteria"]),
  limits:"No unsupported CRM access, unverified supplier fulfillment, or production payment changes"
 })
]);
export const LITIX_B2B_OFFER_BY_ID=Object.freeze(Object.fromEntries(LITIX_B2B_OFFERS.map(item=>[item.id,item])));
export const LITIX_B2B_OFFER_OPTIONS=Object.freeze(Object.fromEntries(LITIX_B2B_OFFERS.map(({id,name})=>[id,name])));
export function selectedB2BOffer(id){
 return LITIX_B2B_OFFER_BY_ID[id]||null;
}
