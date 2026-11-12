import { NextResponse } from "next/server";
import { buildNativeGrowthKit } from "../../../../lib/litixNativeGrowthEngine.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8192;
const headers = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow"
};
const reply = (body, status = 200) => NextResponse.json(body, { status, headers });

async function limitedBody(request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) throw new Error("brief_too_large");
  if (!request.body) throw new Error("empty_brief");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, result = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error("brief_too_large");
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  if (!result.trim()) throw new Error("empty_brief");
  return JSON.parse(result);
}

export async function GET() {
  return reply({
    service: "litix_first_party_growth_kit",
    providedBy: "Litix",
    technology: "litix_owned",
    available: true,
    priceUsd: 0,
    deliverable: "Twelve original editable marketing caption and video-brief drafts across four channels",
    url: "/growth-studio",
    socialPostPublished: false,
    actualLikesOrFollowersDelivered: false,
    paymentCheckoutEnabledByThisService: false
  });
}

export async function POST(request) {
  const type = request.headers.get("content-type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(type)) return reply({ error: "json_required" }, 415);
  let input;
  try {
    input = await limitedBody(request);
  } catch (error) {
    return reply({ error: error?.message === "brief_too_large" ? "brief_too_large" : "invalid_brief_json" },
      error?.message === "brief_too_large" ? 413 : 400);
  }
  try {
    const kit = buildNativeGrowthKit(input);
    return reply({
      service: "litix_first_party_growth_kit",
      providedBy: "Litix",
      status: "generated_draft",
      chargeAttempted: false,
      supplierApiCalled: false,
      actualLikesOrFollowersDelivered: false,
      socialPostPublished: false,
      kit
    });
  } catch {
    return reply({
      error: "invalid_campaign_brief",
      required: ["brand", "audience", "pain", "solution", "cta", "landingUrl"]
    }, 422);
  }
}
