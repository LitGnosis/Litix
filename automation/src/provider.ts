import { Supplier } from "@prisma/client";

export class RejectedOrder extends Error {}
export class UnknownOutcome extends Error {}

export interface SupplierStatus {
  status: string;
  remains: number | null;
}
const allowedHostnames = () => new Set(
  (process.env.LITIX_SUPPLIER_HOST_ALLOWLIST || "boostero.com")
    .split(",").map(x => x.trim().toLowerCase()).filter(Boolean)
);
function endpoint(s: Supplier): string {
  const url = new URL(s.endpointUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !allowedHostnames().has(url.hostname.toLowerCase())) throw Error("SUPPLIER_NOT_ALLOWLISTED");
  return url.toString();
}
function credentials(s: Supplier): string {
  if (!/^[A-Z][A-Z0-9_]{3,80}$/.test(s.credentialEnvKey)) throw Error("BAD_CREDENTIAL_REFERENCE");
  const secret = process.env[s.credentialEnvKey];
  if (!secret) throw Error("SUPPLIER_CREDENTIAL_MISSING");
  return secret;
}

async function api(s: Supplier, action: string, params: Record<string,string> = {}) {
  const response = await fetch(endpoint(s), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: credentials(s), action, ...params }),
    signal: AbortSignal.timeout(13000),
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status >= 500) throw new UnknownOutcome("SUPPLIER_HTTP_5XX");
    throw new RejectedOrder("SUPPLIER_HTTP_" + response.status);
  }
  let data: unknown;
  try { data = await response.json(); } catch { throw new UnknownOutcome("SUPPLIER_NON_JSON"); }
  if (data === null || typeof data !== "object") throw new UnknownOutcome("SUPPLIER_BAD_JSON");
  if ("error" in data && data.error) throw new RejectedOrder("SUPPLIER_REJECTED");
  return data as Record<string,unknown>;
}

export async function add(s: Supplier, serviceId: string, link: string, quantity: number) {
  const data = await api(s, "add", {service: serviceId, link, quantity: String(quantity)});
  const orderId = String(data.order ?? "");
  if (!/^\d{1,30}$/.test(orderId)) throw new UnknownOutcome("UNVERIFIED_ORDER_RECEIPT");
  return orderId;
}
export async function status(s: Supplier, orderId: string): Promise<SupplierStatus> {
  const data = await api(s, "status", {order: orderId});
  const n = data.remains === undefined || data.remains === null ? null : Number(data.remains);
  return {
    status: String(data.status ?? "Unknown"),
    remains: n !== null && Number.isSafeInteger(n) && n >= 0 ? n : null,
  };
}
export async function balanceCents(s: Supplier): Promise<number> {
  const data = await api(s, "balance");
  const number = Number(data.balance);
  if (String(data.currency).toUpperCase() !== "USD" || !Number.isFinite(number) || number < 0)
    throw Error("SUPPLIER_BALANCE_INVALID");
  return Math.round(number * 100);
}
export async function requestCancellation(s: Supplier, orderId: string): Promise<boolean> {
  const data = await api(s, "cancel", { orders: orderId });
  if (!Array.isArray(data) || data.length !== 1) return false;
  const item = data[0] as Record<string,unknown>;
  return String(item.order) === orderId && item.cancel === 1;
}
export async function notifyAlert(code: string, data: Record<string,string|number>) {
  const url = process.env.LITIX_ALERT_WEBHOOK_URL;
  if (!url) return;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") return;
  await fetch(url, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({text: "Litix Warrior " + code + ": " + JSON.stringify(data), content: "Litix Warrior " + code + ": " + JSON.stringify(data)}),
    signal: AbortSignal.timeout(5000),
  });
}
