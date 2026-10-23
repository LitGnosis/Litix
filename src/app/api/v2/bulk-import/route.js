import { neon } from "@neondatabase/serverless";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const send = (body, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
const db = () => neon(process.env.LITIX_V2_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL);

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
function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}
function verifySessionToken(token) {
  const secret = process.env.JWT_SECRET;
  const parts = String(token || "").split(".");
  if (!secret || parts.length !== 3) return null;
  try {
    const header = JSON.parse(decodeBase64Url(parts[0]).toString("utf8"));
    const payload = JSON.parse(decodeBase64Url(parts[1]).toString("utf8"));
    if (header.alg !== "HS256" || (header.typ && header.typ !== "JWT")) return null;
    const hmacSignature = createHmac("sha256", secret).update(parts[0] + "." + parts[1]).digest();
    const supplied = decodeBase64Url(parts[2]);
    if (hmacSignature.length !== supplied.length || !timingSafeEqual(hmacSignature, supplied)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    if (payload.nbf != null && (typeof payload.nbf !== "number" || payload.nbf > now)) return null;
    if (process.env.JWT_ISSUER && payload.iss !== process.env.JWT_ISSUER) return null;
    if (process.env.JWT_AUDIENCE) {
      const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!aud.includes(process.env.JWT_AUDIENCE)) return null;
    }
    return typeof payload.userId === "string" && payload.userId ? payload : null;
  } catch { return null; }
}
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
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

export async function POST(request) {
  let payload;
  try { payload = await request.json(); } catch { return send({ error: "Request body must be valid JSON." }, 400); }

  const auth = request.headers.get("authorization") || "";
  const session = auth.startsWith("Bearer ") ? verifySessionToken(auth.slice(7).trim()) : null;
  if (!session) return send({ error: "A valid signed session token is required." }, 401);
  const workspaceId = String(payload?.workspaceId || "").trim();
  const userId = session.userId;
  const rows = payload?.csvRows;
  const previewOnly = payload?.isPreviewOnly === true;
  if (!userId || !workspaceId) return send({ error: "Authenticated user and workspace scope are required." }, 401);
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100) {
    return send({ error: "Each import must contain between 1 and 100 rows." }, 400);
  }

  const normalizedRows = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const targetLink = normalizeTarget(row?.targetLink);
    const serviceId = Number(row?.resolvedClusterID);
    const quantity = Number(row?.quantity);
    if (!targetLink) return send({ error: "A target URL is invalid or uses an unsupported platform.", row: index + 1 }, 422);
    if (!Number.isSafeInteger(serviceId) || serviceId <= 0) return send({ error: "A valid catalog service ID is required.", row: index + 1 }, 422);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000000) return send({ error: "Quantity must be a positive integer within the supported limit.", row: index + 1 }, 422);
    normalizedRows.push({ targetLink, resolvedClusterID: serviceId, quantity });
  }

  const canonicalRequest = JSON.stringify(canonicalize({ workspaceId, csvRows: normalizedRows }));
  const computedKey = sha256(canonicalRequest);
  const suppliedKey = request.headers.get("x-idempotency-key") || "";
  if (!/^[a-f0-9]{64}$/.test(suppliedKey) || !safeEqual(suppliedKey, computedKey)) {
    return send({ error: "X-Idempotency-Key must be the SHA-256 hash of the normalized workspace and batch payload.", expectedFormat: "64 lowercase hexadecimal characters" }, 412);
  }

  try {
    const sql = db();
    const memberships = await sql.query(
      "select role from litix_workspace_members where workspace_id = $1 and user_id = $2 limit 1",
      [workspaceId, userId]
    );
    if (!memberships.length) return send({ error: "Workspace membership is missing or has been revoked." }, 403);
    const role = String(memberships[0].role).toLowerCase();
    if (!["owner", "admin", "manager", "operator"].includes(role)) {
      return send({ error: "Your current workspace role cannot import or purchase services." }, 403);
    }

    // Only preview requests are currently enabled. Never accept a client-supplied price or service mapping.
    const serviceIds = [...new Set(normalizedRows.map((row) => row.resolvedClusterID))];
    const catalog = await sql.query(
      "select service_id, service_name, base_rate, retail_rate from litix_catalog_prices where service_id = any($1::int[])",
      [serviceIds]
    );
    const catalogById = new Map(catalog.map((item) => [Number(item.service_id), item]));
    const pricedRows = [];
    let total = 0;

    for (let index = 0; index < normalizedRows.length; index++) {
      const row = normalizedRows[index];
      const item = catalogById.get(row.resolvedClusterID);
      if (!item) return send({ error: "A requested service is not present in the server catalog.", row: index + 1, serviceId: row.resolvedClusterID }, 422);
      const baseRate = Number(item.base_rate);
      const storedRetailRate = Number(item.retail_rate);
      if (!Number.isFinite(baseRate) || baseRate < 0 || !Number.isFinite(storedRetailRate) ||
          Math.abs(storedRetailRate - baseRate * 11) > 0.0001) {
        return send({ error: "Catalog pricing requires administrator reconciliation before checkout.", serviceId: row.resolvedClusterID }, 503);
      }
      const retailRate = baseRate * 11;
      const lineTotal = Math.round(retailRate * row.quantity) / 1000;
      total += lineTotal;
      pricedRows.push({
        row: index + 1,
        serviceId: row.resolvedClusterID,
        serviceName: item.service_name,
        targetLink: row.targetLink,
        quantity: row.quantity,
        retailRatePerThousand: retailRate.toFixed(4),
        lineTotal: lineTotal.toFixed(2),
      });
    }
    total = Math.round((total + Number.EPSILON) * 100) / 100;

    if (!previewOnly) {
      // PayKings' production API endpoint, authentication, and settlement/webhook contract
      // must be configured from verified merchant documentation before live charging is enabled.
      return send({
        error: "Checkout is disabled until the verified PayKings integration and signed settlement webhook are configured.",
        preflightStatus: "VALIDATED",
        aggregatedRetailValue: total.toFixed(2),
        verifiedItemsCount: pricedRows.length,
        chargeInitiated: false,
        fulfillmentDispatched: false,
      }, 503);
    }

    const response = {
      preflightStatus: "VALIDATED_SUCCESSFULLY",
      workspaceId,
      idempotencyKey: computedKey,
      aggregatedRetailValue: total.toFixed(2),
      verifiedItemsCount: pricedRows.length,
      pricingBasis: "catalog base rate × 11; price per 1,000 units",
      chargeInitiated: false,
      fulfillmentDispatched: false,
      items: pricedRows,
    };
    await sql.query(
      "insert into litix_idempotency_records(request_hash,workspace_id,status,response_log,created_at,updated_at) values($1,$2,'SUCCESS',$3::jsonb,now(),now()) on conflict(request_hash) do nothing",
      [computedKey, workspaceId, JSON.stringify(response)]
    );
    const prior = await sql.query(
      "select status,response_log,workspace_id from litix_idempotency_records where request_hash=$1 limit 1",
      [computedKey]
    );
    if (prior.length && prior[0].workspace_id === workspaceId && prior[0].response_log) {
      return send(prior[0].response_log);
    }
    return send(response);
  } catch (error) {
    console.error("Bulk importer preflight failed", error);
    return send({ error: "Importer storage or pricing validation is unavailable. No charge or fulfillment was initiated." }, 503);
  }
}
