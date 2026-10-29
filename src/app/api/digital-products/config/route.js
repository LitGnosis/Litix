import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const products = new Set(["creator-launch-kit", "social-growth-toolkit", "agency-starter-pack"]);

function gatewayReady() {
  const mode = process.env.LITIX_DIGITAL_GATEWAY_MODE;
  const key = mode === "TEST"
    ? process.env.LITIX_DIGITAL_TEST_GATEWAY_KEY
    : mode === "PRODUCTION"
      ? process.env.LITIX_DIGITAL_PRODUCTION_GATEWAY_KEY
      : "";
  const urlValue = mode === "TEST"
    ? process.env.LITIX_DIGITAL_TEST_GATEWAY_URL
    : mode === "PRODUCTION"
      ? process.env.LITIX_DIGITAL_PRODUCTION_GATEWAY_URL
      : "";
  if (!key || !urlValue) return false;
  try {
    const url = new URL(urlValue);
    if (url.protocol !== "https:") return false;
    if (mode === "PRODUCTION") return url.hostname === "paykings.transactiongateway.com";
    return mode === "TEST" && url.hostname !== "paykings.transactiongateway.com";
  } catch {
    return false;
  }
}

export async function GET(request) {
  const productId = new URL(request.url).searchParams.get("productId") || "";
  const publicKey = process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY || process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY || "";
  const baseReady = process.env.LITIX_DIGITAL_SALES_ENABLED === "true" &&
    Boolean(process.env.LITIX_DIGITAL_DATABASE_URL) &&
    Boolean(publicKey) &&
    gatewayReady() &&
    Boolean(process.env.RESEND_API_KEY) &&
    Boolean(process.env.EMAIL_FROM);

  if (!products.has(productId) || !baseReady) {
    return Response.json({ ready: false }, {
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }

  try {
    const sql = neon(process.env.LITIX_DIGITAL_DATABASE_URL);
    const assets = await sql.query(
      "select product_id from litix_digital_assets where product_id = $1 and is_active = true limit 1",
      [productId],
    );
    return Response.json({ ready: assets.length > 0, publicKey: assets.length ? publicKey : undefined }, {
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch {
    return Response.json({ ready: false }, {
      status: 503,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }
}
