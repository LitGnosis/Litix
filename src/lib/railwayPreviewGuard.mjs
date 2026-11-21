// By default, Railway migration previews expose only explicit read-only probes.
// Vercel production never sets Railway's project ID and keeps existing routing.
const readOnlyPreviewApiPaths = new Set([
  "/api/status",
  "/api/fulfillment/health",
  "/api/checkout/readiness",
]);
export function isBlockedRailwayPreviewRequest({ env = process.env, pathname, method }) {
  if (!env.RAILWAY_PROJECT_ID || env.RAILWAY_MIGRATION_READONLY !== "true") return false;
  if (method !== "GET" && method !== "HEAD") return true;
  if (pathname.startsWith("/api/") && !readOnlyPreviewApiPaths.has(pathname)) return true;
  return false;
}
