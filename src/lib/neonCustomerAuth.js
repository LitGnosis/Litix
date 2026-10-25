import { createNeonAuth } from "@neondatabase/auth/next/server";

// Never instantiate a client until the operator has explicitly selected Neon Auth.
// Auth0 remains a separately supported provider for a future tenant migration.
export function neonAuthConfigured() {
  if (process.env.LITIX_CUSTOMER_LOGIN_ENABLED !== "true" || process.env.LITIX_IDENTITY_PROVIDER !== "neon") return false;
  const u = process.env.NEON_AUTH_BASE_URL || "";
  const secret = process.env.NEON_AUTH_COOKIE_SECRET || "";
  try {
    const url = new URL(u);
    return url.protocol === "https:" &&
      url.hostname.endsWith(".neon.tech") &&
      url.pathname.endsWith("/auth") &&
      secret.length >= 32;
  } catch { return false }
}
let instance;
export function getNeonCustomerAuth() {
  if (!neonAuthConfigured()) return null;
  if (!instance) instance = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET, sameSite: "lax" },
    logLevel: "warn",
  });
  return instance;
}
