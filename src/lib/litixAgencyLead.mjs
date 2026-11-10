import {cleanPartnerAttribution} from "./litixPartnerAttribution.mjs";
import {selectedB2BOffer} from "./litixB2BOffers.mjs";

// Qualification options only. These are prospective buyers' stated budgets,
// never sales, commitments, guarantees or collected payment details.
export const AGENCY_SEGMENTS=Object.freeze({
 business:"Small business / local brand",
 agency:"Marketing agency / client services"
});
export const AGENCY_GOALS=Object.freeze({
 leads:"Qualified leads and conversion tracking",
 content:"Content planning and creative workflow",
 local:"Local search visibility and website clarity",
 agency:"Managing multiple client campaigns"
});
export const AGENCY_BUDGETS=Object.freeze({
 unsure:"Budget not determined",
 under_1000:"Under $1,000 per month",
 from_1000:"$1,000–$4,999 per month",
 from_5000:"$5,000+ per month"
});
const clean=(x,max)=>typeof x==="string"?x.trim().replace(/\s+/g," ").slice(0,max):"";
export function buildAgencyLeadPayload(raw,query={}){
 if(!raw||typeof raw!=="object")throw Error("Invalid business inquiry.");
 const segment=String(raw.segment||"");
 const goal=String(raw.goal||"");
 const budget=String(raw.budget||"");
 if(!Object.hasOwn(AGENCY_SEGMENTS,segment)||!Object.hasOwn(AGENCY_GOALS,goal)||!Object.hasOwn(AGENCY_BUDGETS,budget))throw Error("Please complete the business and project selections.");
 const extra=clean(raw.notes,300);
 const offerId=typeof raw.offer==="string"?raw.offer:"lead-response";
 const requestedOffer=selectedB2BOffer(offerId);
 if(!requestedOffer)throw Error("Select a valid proposal type.");
 const goals=[
  "Business marketing inquiry. Segment: "+AGENCY_SEGMENTS[segment]+".",
  "Proposal requested: "+requestedOffer.name+" (quote only).",
  "Primary goal: "+AGENCY_GOALS[goal]+".",
  "Stated monthly budget: "+AGENCY_BUDGETS[budget]+".",
  extra?"Project details: "+extra+".":""
 ].filter(Boolean).join(" ");
 return {
  name:clean(raw.name,100),
  email:clean(raw.email,254),
  organization:clean(raw.organization,120),
  website:"",
  type:segment==="agency"?"agency":"business",
  goals:goals.slice(0,1000),
  consent:raw.consent===true,
  websiteTrap:clean(raw.websiteTrap,100),
  attribution:cleanPartnerAttribution({
   ...query,
   utm_source:query.utm_source||"agency_growth_page",
   utm_campaign:query.utm_campaign||"agency_inquiry"
  })
 };
}
