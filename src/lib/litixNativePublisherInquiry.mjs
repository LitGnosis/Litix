// Genuine publisher supply intake. This only submits a reviewed application
// through the existing Litix consent + Resend contact pipeline.
// It NEVER approves inventory, pays publishers or publishes sponsored content.
import {validatePartnerInquiry} from "./partnerApplications.mjs";
const channels=new Set(["instagram","tiktok","youtube","x","facebook","linkedin","newsletter","website","search","other"]);
const formats=new Set(["original_content","sponsored_post","newsletter_sponsorship","website_placement","campaign_reporting","managed_ads"]);
const clean=(v,max)=>typeof v==="string"?v.trim().replace(/[\x00-\x1f\x7f]/g," ").replace(/\s+/g," ").slice(0,max):"";
const normalize=(raw={})=>({
 name:clean(raw.name,100),email:clean(raw.email,254),organization:clean(raw.organization,120),
 website:clean(raw.website,300),channel:clean(raw.channel,30),
 format:clean(raw.format,60),regions:clean(raw.regions,120),
 niche:clean(raw.niche,150),experience:clean(raw.experience,350),
 consent:raw.consent===true,
 rightsConfirmed:raw.rightsConfirmed===true,
 disclosureConfirmed:raw.disclosureConfirmed===true,
 websiteTrap:raw.websiteTrap
});
export function buildLitixPublisherInquiry(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {ok:false,error:"Invalid application."};
 const v=normalize(raw);
 if(!channels.has(v.channel)||!formats.has(v.format))
  return {ok:false,error:"Select a valid publishing channel and service."};
 if(v.regions.length<2||v.niche.length<3||v.experience.length<12)
  return {ok:false,error:"Describe your audience, regions, and genuine services."};
 if(!v.rightsConfirmed||!v.disclosureConfirmed)
  return {ok:false,error:"Confirm content rights and sponsorship disclosure requirements."};
 const goals=[
  "Publisher network capacity proposal (NOT approved supply).",
  "Channel: "+v.channel,
  "Offer: "+v.format,
  "Markets: "+v.regions,
  "Content niche: "+v.niche,
  "Evidence and proposed scope: "+v.experience,
  "Applicant attests rights and required disclosures. Audience and inventory unverified."
 ].join("\n");
 const checked=validatePartnerInquiry({
  name:v.name,email:v.email,organization:v.organization,website:v.website,
  type:"publisher",goals,consent:v.consent,websiteTrap:v.websiteTrap
 });
 if(!checked.ok)return checked;
 return {ok:true,data:checked.data,unverified:true,inventoryCreated:false};
}
