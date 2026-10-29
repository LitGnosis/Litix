import { neon } from "@neondatabase/serverless";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const send = (body, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
const db = () => neon(process.env.LITIX_V2_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL);

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized + "=".repeat((4 - (normalized.length % 4)) % 4), "base64");
}
function verifySessionToken(token) {
  const secret = process.env.JWT_SECRET;
  const parts = String(token || "").split(".");
  if (!secret || parts.length !== 3) return null;
  try {
    const header = JSON.parse(decodeBase64Url(parts[0]).toString("utf8"));
    const payload = JSON.parse(decodeBase64Url(parts[1]).toString("utf8"));
    if (header.alg !== "HS256" || (header.typ && header.typ !== "JWT")) return null;
    const expected = createHmac("sha256", secret).update(parts[0] + "." + parts[1]).digest();
    const supplied = decodeBase64Url(parts[2]);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    if (payload.nbf != null && (typeof payload.nbf !== "number" || payload.nbf > now)) return null;
    if (process.env.JWT_ISSUER && payload.iss !== process.env.JWT_ISSUER) return null;
    if (process.env.JWT_AUDIENCE) {
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(process.env.JWT_AUDIENCE)) return null;
    }
    return typeof payload.userId === "string" && payload.userId ? payload : null;
  } catch {
    return null;
  }
}
function normalizeTarget(raw) {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const allowed = new Set([
    "instagram.com", "www.instagram.com",
    "tiktok.com", "www.tiktok.com",
    "facebook.com", "www.facebook.com", "m.facebook.com",
    "youtube.com", "www.youtube.com", "youtu.be",
  ]);
  if (!allowed.has(host)) return null;
  if (!/^\/[a-zA-Z0-9_./%~-]*$/.test(url.pathname) || url.pathname.includes("..")) return null;
  if (url.search.length > 500 || url.hash) return null;
  return url.toString();
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request) {
  const auth = request.headers.get("authorization") || "";
  const session = auth.startsWith("Bearer ") ? verifySessionToken(auth.slice(7).trim()) : null;
  if (!session) return send({ error: "A valid signed session token is required." }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return send({ error: "Request body must be valid JSON." }, 400);
  }

  const workspaceId = String(body?.workspaceId || "").trim();
  const rows = body?.csvRows;
  const requestHash = String(body?.requestHash || "");
  const customerPhone = typeof body?.customerPhone === "string" ? body.customerPhone.trim() : "";

  if (!workspaceId) return send({ error: "Workspace scope is required." }, 400);
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) {
    return send({ error: "Provide between 1 and 100 order rows." }, 400);
  }
  if (customerPhone.length > 32 || (customerPhone && !/^\+?[0-9 ()-]{7,32}$/.test(customerPhone))) {
    return send({ error: "Customer phone number is invalid." }, 422);
  }

  const normalizedRows = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const serviceId = Number(row?.resolvedClusterID);
    const quantity = Number(row?.quantity);
    const targetLink = normalizeTarget(row?.targetLink);
    if (!targetLink) return send({ error: "A target URL is invalid or uses an unsupported platform.", row: index + 1 }, 422);
    if (!Number.isSafeInteger(serviceId) || serviceId <= 0 ||
        !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000000) {
      return send({ error: "A service ID or quantity is invalid.", row: index + 1 }, 422);
    }
    normalizedRows.push({ targetLink, resolvedClusterID: serviceId, quantity });
  }

  const canonicalRequest = JSON.stringify(canonicalize({ workspaceId, csvRows: normalizedRows }));
  const computedHash = sha256(canonicalRequest);
  if (!/^[a-f0-9]{64}$/.test(requestHash) || !safeEqual(requestHash, computedHash)) {
    return send({ error: "requestHash does not match the normalized order and workspace." }, 412);
  }

  try {
    const sql = db();
    const memberships = await sql.query(
      "select role from litix_workspace_members where workspace_id = $1 and user_id = $2 limit 1",
      [workspaceId, session.userId]
    );
    if (!memberships.length) return send({ error: "Workspace membership is missing or has been revoked." }, 403);
    if (!["owner", "admin", "manager", "operator"].includes(String(memberships[0].role).toLowerCase())) {
      return send({ error: "Your workspace role cannot initiate a purchase." }, 403);
    }

    const serviceIds = [...new Set(normalizedRows.map((row) => row.resolvedClusterID))];
    const catalog = await sql.query(
      "select service_id, base_rate, retail_rate from litix_catalog_prices where service_id = any($1::int[])",
      [serviceIds]
    );
    const byId = new Map(catalog.map((item) => [Number(item.service_id), item]));
    let totalCents = 0;

    for (let index = 0; index < normalizedRows.length; index++) {
      const row = normalizedRows[index];
      const item = byId.get(row.resolvedClusterID);
      if (!item) return send({ error: "A requested service is not in the server catalog.", row: index + 1 }, 422);
      const baseRate = Number(item.base_rate);
      const storedRetail = Number(item.retail_rate);
      const expectedRetail = Math.round((baseRate * 2.5 + Number.EPSILON) * 10000) / 10000;
      if (!Number.isFinite(baseRate) || baseRate <= 0 || !Number.isFinite(storedRetail) ||
          Math.abs(storedRetail - expectedRetail) > 0.0001) {
        return send({ error: "Catalog pricing needs administrator reconciliation.", serviceId: row.resolvedClusterID }, 503);
      }
      const lineCents = Math.round(expectedRetail * row.quantity / 1000 * 100);
      totalCents += lineCents;
    }

    const amount = (totalCents / 100).toFixed(2);
    if (totalCents <= 0) return send({ error: "Payment amount must be greater than zero." }, 422);

    // Deliberately fail closed: no EPS endpoint or response contract has been verified for Litix.
    // Do not send customer/order data to a provider or return a redirect URL until merchant
    // documentation, callback signature verification, and a durable payment-intent schema exist.
    return send({
      error: "EPS checkout is not enabled yet. No payment request was sent and no funds were charged.",
      code: "PAYMENT_PROVIDER_NOT_CONFIGURED",
      preflightStatus: "VALIDATED",
      currency: "BDT",
      pricingBasis: "catalog base rate × 2.5; price per 1,000 units",
      amount,
      requestHash: computedHash,
      chargeInitiated: false,
      fulfillmentDispatched: false,
    }, 503);
  } catch (error) {
    console.error("EPS payment preflight failed", error);
    return send({ error: "Payment preflight is unavailable. No payment request was sent." }, 503);
  }
}
