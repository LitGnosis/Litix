import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const databaseUrl = process.env.LITIX_V2_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;
  const databaseConfigured = Boolean(databaseUrl);
  const supplierConfigured = Boolean(process.env.BOOSTERO_API_KEY && process.env.BOOSTERO_API_URL);
  const supplierUrl = process.env.BOOSTERO_API_URL || "";
  let supplierHostValid = false;
  try {
    const url = new URL(supplierUrl);
    supplierHostValid = url.protocol === "https:" && !url.username && !url.password;
  } catch {}

  // Deliberately do not contact the supplier or payment gateway from a health check.
  let databaseReachable = false;
  if (databaseUrl) {
    try {
      await neon(databaseUrl).query("select 1", []);
      databaseReachable = true;
    } catch {
      databaseReachable = false;
    }
  }
  const healthy = databaseReachable;
  return NextResponse.json({
    service: "Litix",
    status: healthy ? "healthy" : "degraded",
    components: {
      database: !databaseConfigured ? "missing" : databaseReachable ? "reachable" : "unreachable",
      supplierCredentials: supplierConfigured ? "configured-not-tested" : "missing",
      supplierEndpoint: supplierHostValid ? "valid-not-tested" : "invalid",
      payment: "not-checked"
    },
    liveSupplierCatalogVerified: false,
    paymentChecked: false,
    timestamp: new Date().toISOString()
  }, {
    status: healthy ? 200 : 503,
    headers: { "cache-control": "no-store" }
  });
}
