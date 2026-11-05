import {createHash} from "node:crypto";
import {validatePartnerInquiry} from "../../../lib/partnerApplications.mjs";
import {partnerAttributionLabel} from "../../../lib/litixPartnerAttribution.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const respond = (body, status = 200) => Response.json(body, {
  status, headers: {"cache-control":"no-store", "x-content-type-options":"nosniff"}
});
const key = () => process.env.RESEND_API_KEY || process.env.LITIX_RESEND_API_KEY || "";

export async function POST(request) {
  // Same-site browser submissions only. Also apply edge/WAF rate limiting before scaling.
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  if (!origin || (origin !== requestOrigin && !["https://litix.net","https://www.litix.net"].includes(origin))) {
    return respond({error:"Unsupported submission origin."}, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return respond({error:"Expected JSON."}, 415);
  }
  const reportedLength = Number(request.headers.get("content-length") || 0);
  if (reportedLength > 8192) return respond({error:"Inquiry is too large."}, 413);
  let raw;
  try {
    const text = await request.text();
    if (text.length > 8192) return respond({error:"Inquiry is too large."}, 413);
    raw = JSON.parse(text);
  } catch { return respond({error:"Invalid request."}, 400); }
  const checked = validatePartnerInquiry(raw);
  if (checked.spam) return respond({ok:true});
  if (!checked.ok) return respond({error:checked.error}, 400);

  const resendKey = key();
  if (!resendKey) return respond({error:"Applications are temporarily unavailable. Email litixsocial@gmail.com instead."}, 503);
  const {name,email,organization,website,type,goals,attribution} = checked.data;
  const body = [
    "New Litix partner interest — manual review required",
    "Partnership type: " + type,
    "Source tags (unverified client-provided): " + partnerAttributionLabel(attribution),
    "Name: " + name,
    "Email: " + email,
    "Organization: " + (organization || "Not supplied"),
    "Public website: " + (website || "Not supplied"),
    "Proposal:",
    goals,
    "",
    "No referral code, commission, payout, wholesale pricing, or supplier order has been created."
  ].join("\n");
  const digest = createHash("sha256").update(JSON.stringify({name,email,organization,website,type,goals,day:new Date().toISOString().slice(0,10)})).digest("hex");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method:"POST",
      headers:{
        "authorization":"Bearer " + resendKey,
        "content-type":"application/json",
        "Idempotency-Key":"litix-partner-" + digest.slice(0,48)
      },
      body:JSON.stringify({
        from:"Litix <orders@litix.net>",
        to:["litixsocial@gmail.com", "litgnosisllc@gmail.com"],
        reply_to:email,
        subject:"Litix — New partner application (" + type + ")",
        text:body
      }),
      cache:"no-store",
      signal:AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      console.error("Partner inquiry email rejected", {status:response.status});
      return respond({error:"We couldn't send your inquiry. Please email litixsocial@gmail.com."}, 503);
    }
    return respond({ok:true});
  } catch {
    return respond({error:"We couldn't send your inquiry. Please email litixsocial@gmail.com."}, 503);
  }
}
