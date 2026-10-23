import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const databaseConfigured = Boolean(
    process.env.LITIX_V2_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL
  );
  const supplierConfigured = Boolean(process.env.SMMFOLLOWOM_API_KEY);
  const supplierUrl = process.env.SMMFOLLOWOM_API_URL || "https://smmfollowom.com/api/v2";
  let supplierHostValid = false;
  try {
    const url = new URL(supplierUrl);
    supplierHostValid = url.protocol === "https:" &&
      ["smmfollowom.com", "www.smmfollowom.com", "my.smmfollowom.com"].includes(url.hostname);
  } catch {}

  // Intentionally do not call payment APIs, supplier APIs, or reveal secrets here.
  // This endpoint reports configuration readiness only, not a live transaction test.
  const configured = databaseConfigured && supplierConfigured && supplierHostValid;
  return NextResponse.json({
    service: "Litix",
    status: configured ? "operational-configuration" : "needs-configuration",
    components: {
      database: databaseConfigured ? "configured" : "missing",
      supplierApiKey: supplierConfigured ? "configured" : "missing",
      supplierEndpoint: supplierHostValid ? "valid" : "invalid"
    },
    liveSupplierCatalogVerified: false,
    paymentChecked: false,
    timestamp: new Date().toISOString()
  }, {
    status: configured ? 200 : 503,
    headers: { "cache-control": "no-store" }
  });
}
