import { neon } from "@neondatabase/serverless";
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const send = (body, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});
const getDb = () => neon(process.env.LITIX_V2_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL);

function authorized(request) {
  const expected = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET || process.env.LITIX_CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!expected || !supplied) return false;
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request) {
  if (!authorized(request)) return send({ error: "Unauthorized" }, 401);

  const endpoint = process.env.BOOSTERO_API_URL;
  const apiKey = process.env.BOOSTERO_API_KEY;
  if (!endpoint || !apiKey) {
    return send({ error: "Supplier API URL/key are not configured; catalog was not changed." }, 503);
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(endpoint);
    if (upstreamUrl.protocol !== "https:" || upstreamUrl.username || upstreamUrl.password) throw new Error("Boostero HTTPS endpoint required");
  } catch {
    return send({ error: "BOOSTERO_API_URL must be a valid HTTPS API endpoint." }, 503);
  }

  try {
    // SMM panel APIs commonly accept URL-encoded form fields. The exact endpoint must be
    // configured from the supplier's account documentation; credentials stay server-side.
    const body = JSON.stringify({ key: apiKey, action: "services" });
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "POST",
      headers: { "accept": "application/json", "content-type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });

    if (!upstream.ok) {
      console.error("Supplier catalog sync rejected", { status: upstream.status });
      return send({ error: "Supplier catalog request failed; catalog remains unchanged." }, 502);
    }

    const data = await upstream.json();
    if (!Array.isArray(data) || data.length === 0 || data.length > 100000) {
      return send({ error: "Supplier catalog response had an unexpected shape; catalog remains unchanged." }, 502);
    }

    const catalog = [];
    const seen = new Set();
    for (const item of data) {
      const serviceId = Number(item?.service);
      const serviceName = typeof item?.name === "string" ? item.name.trim().slice(0, 300) : "";
      const baseRate = Number(item?.rate);
      if (!Number.isSafeInteger(serviceId) || serviceId <= 0 || !serviceName ||
          !Number.isFinite(baseRate) || baseRate < 0 || baseRate > 1000000 || seen.has(serviceId)) {
        continue;
      }
      seen.add(serviceId);
      // Litix retail uses the requested 2.5× supplier-rate multiplier.
      catalog.push({ serviceId, serviceName, baseRate, retailRate: Math.round((baseRate * 2.5 + Number.EPSILON) * 10000) / 10000 });
    }
    if (catalog.length === 0) return send({ error: "No valid services were found; catalog remains unchanged." }, 502);

    // One atomic PostgreSQL statement: either every valid catalog row is upserted or none is.
    const sql = getDb();
    const ids = catalog.map((item) => item.serviceId);
    const names = catalog.map((item) => item.serviceName);
    const baseRates = catalog.map((item) => item.baseRate);
    const retailRates = catalog.map((item) => item.retailRate);
    const result = await sql.query(
      `insert into litix_catalog_prices (service_id, service_name, base_rate, retail_rate, updated_at)
       select source.service_id, source.service_name, source.base_rate, source.retail_rate, now()
       from unnest($1::int[], $2::text[], $3::numeric[], $4::numeric[])
         as source(service_id, service_name, base_rate, retail_rate)
       on conflict (service_id) do update set
         service_name = excluded.service_name,
         base_rate = excluded.base_rate,
         retail_rate = excluded.retail_rate,
         updated_at = now()
       returning service_id`,
      [ids, names, baseRates, retailRates]
    );

    return send({
      synchronizationState: "SUCCESS",
      catalogClustersUpdated: result.length,
      skippedInvalidRows: data.length - catalog.length,
      pricingFormula: "baseRate × 2.5",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Catalog sync failed", { message: error instanceof Error ? error.message : "unknown error" });
    return send({ error: "Catalog synchronization failed; verify supplier credentials, endpoint, and database connectivity." }, 503);
  }
}
