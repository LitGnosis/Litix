/**
 * Privacy-minimal source tags for manual Litix partner applications.
 * Values are client supplied and MUST NOT be treated as proof of a referral
 * payout, paid order, or revenue attribution.
 * No cookies, third-party trackers, IPs, click IDs, emails or device fingerprints.
 */
export const PARTNER_SOURCE_FIELDS=Object.freeze(["utm_source","utm_medium","utm_campaign","utm_content","ref"]);
export function cleanPartnerAttribution(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return Object.freeze({});
 const out={};
 for(const field of PARTNER_SOURCE_FIELDS){
  const val=raw[field];
  if(typeof val!=="string")continue;
  const trimmed=val.trim();
  if(/^[a-z0-9][a-z0-9_.-]{0,63}$/i.test(trimmed))out[field]=trimmed.toLowerCase();
 }
 return Object.freeze(out);
}
export function partnerAttributionLabel(input){
 const data=cleanPartnerAttribution(input);
 const fields=Object.keys(data);
 return fields.length?fields.map(k=>k+"="+data[k]).join("; "):"direct_or_unknown";
}
