// Public, manually reviewed partner-interest intake. No affiliate payouts are activated here.
import {cleanPartnerAttribution} from "./litixPartnerAttribution.mjs";
export const PARTNER_TYPES = Object.freeze(["agency", "affiliate", "reviewer", "business", "publisher"]);

const clean = (value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
const validWebsite = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol)
      && !url.username && !url.password && url.hostname.includes(".")
      && !/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(url.hostname);
  } catch { return false; }
};

export function validatePartnerInquiry(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {ok:false, error:"Invalid inquiry."};
  // The invisible input catches basic bot fills; callers should acknowledge without delivering it.
  if (clean(raw.websiteTrap)) return {ok:false, spam:true, error:"Invalid inquiry."};
  const data = {
    name: clean(raw.name),
    email: clean(raw.email).toLowerCase(),
    organization: clean(raw.organization),
    website: clean(raw.website),
    type: clean(raw.type),
    goals: typeof raw.goals === "string" ? raw.goals.trim() : "",
    attribution: cleanPartnerAttribution(raw.attribution)
  };
  if (data.name.length < 2 || data.name.length > 100) return {ok:false,error:"Enter a name between 2 and 100 characters."};
  if (!validEmail(data.email)) return {ok:false,error:"Enter a valid email address."};
  if (data.organization.length > 120) return {ok:false,error:"Organization name is too long."};
  if (data.website.length > 300 || !validWebsite(data.website)) return {ok:false,error:"Enter a valid public website URL or leave it blank."};
  if (!PARTNER_TYPES.includes(data.type)) return {ok:false,error:"Select a partnership type."};
  if (data.goals.length < 10 || data.goals.length > 1000) return {ok:false,error:"Describe your partnership idea in 10–1,000 characters."};
  if (raw.consent !== true) return {ok:false,error:"Please confirm that Litix may contact you about your inquiry."};
  return {ok:true,data};
}
