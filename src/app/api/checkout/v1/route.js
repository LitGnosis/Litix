import { NextResponse } from "next/server";
import { POST as runDollarPilot } from "../pilot/route.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reply = (body, status = 200) => NextResponse.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

const HTTPS = /^https:\/\//i;
const allowedCreativeFields = [
  "brand", "campaign", "audience", "pain", "solution", "cta", "landingUrl"
];

export async function POST(request) {
  // The legacy order ID namespace represents reseller-owned services. It is
  // deliberately not a first-party capacity proof; never charge or dispatch it.
  if (new URL(request.url).origin !== request.headers.get("origin"))
    return reply({ error: "same_origin_required", chargeAttempted: false }, 403);

  if (Number(request.headers.get("content-length") || "0") > 12000)
    return reply({ error: "request_too_large", chargeAttempted: false }, 413);

  let data;
  try {
    data = await request.json();
  } catch {
    return reply({ error: "invalid_json", chargeAttempted: false }, 400);
  }

  // The actual $1 paid first-party product is handled by the dedicated
  // NMI merchant-settlement ledger. Reuse that same implementation rather
  // than leaving /api/checkout/v1 as a blanket paid-card rejection.
  // Critically, a reseller catalog ID can NEVER be silently substituted
  // with the creative pilot product.
  if (data?.product === "website_preview") {
    if (data.serviceId != null || data.link != null || data.postAllocations != null ||
        data.serviceKind != null || data.amountCents !== 100) {
      return reply({ error: "pilot_product_mismatch", chargeAttempted: false }, 422);
    }
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    return runDollarPilot(new Request(request.url, {
      method: "POST", headers, body: JSON.stringify(data),
    }));
  }

  if (data?.serviceKind !== "creative_kit") {
    return reply({
      error: "This service has no verified Litix-owned fulfillment capacity. No payment was attempted.",
      code: "FIRST_PARTY_SERVICE_NOT_ENABLED",
      chargeAttempted: false,
      supplierApiCalled: false,
      directServicesUrl: "/direct-services",
      paidFirstPartyTestUrl: "/pilot",
      note: "Catalog IDs cannot be charged until their matching Litix-owned signed delivery node is independently verified.",
    }, 409);
  }

  // A free, verified first-party creative job can enter the owned queue.
  // Paid services must use a separate merchant-settled checkout, never this endpoint.
  if (data?.paymentToken || data?.expectedAmountCents || data?.serviceId)
    return reply({
      error: "No card or legacy supplier identifier is accepted for a free direct job.",
      chargeAttempted: false,
    }, 422);

  const brief = data?.brief;
  if (!brief || typeof brief !== "object" || Array.isArray(brief))
    return reply({ error: "complete_brief_required", chargeAttempted: false }, 422);
  for (const field of allowedCreativeFields) {
    if (typeof brief[field] !== "string" || brief[field].trim().length < 2 ||
        brief[field].length > 500)
      return reply({ error: "invalid_brief_field", field, chargeAttempted: false }, 422);
  }

  let landing;
  try { landing = new URL(brief.landingUrl); } catch {
    return reply({ error: "invalid_landing_url", chargeAttempted: false }, 422);
  }
  if (landing.protocol !== "https:" || landing.username || landing.password)
    return reply({ error: "invalid_landing_url", chargeAttempted: false }, 422);

  const idempotencyKey = String(data.idempotencyKey || "");
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey))
    return reply({ error: "idempotency_key_required", chargeAttempted: false }, 422);

  const api = process.env.LITIX_DIRECT_API_URL || "";
  const token = process.env.LITIX_INTERNAL_SERVICE_TOKEN || "";
  if (!HTTPS.test(api) || token.length < 32)
    return reply({ error: "first_party_backend_not_connected", chargeAttempted: false }, 503);

  try {
    const endpoint = new URL("/v1/internal/direct/orders", api);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        service_kind: "creative_kit", idempotency_key: idempotencyKey,
        brief: Object.fromEntries(allowedCreativeFields.map(k => [k, brief[k]])),
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      return reply({
        error: result.detail || "first_party_dispatch_unavailable",
        chargeAttempted: false,
        supplierApiCalled: false,
      }, response.status);
    return reply({
      orderId: result.job_id,
      fulfillment: result.status,
      payment: "not_applicable_free_creative_job",
      chargeAttempted: false,
      supplierApiCalled: false,
      firstPartyOnly: true,
      queue: "litix:fulfillment:queue",
    }, 202);
  } catch {
    return reply({ error: "first_party_dispatch_unavailable", chargeAttempted: false }, 503);
  }
}
