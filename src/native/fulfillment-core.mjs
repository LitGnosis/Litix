import { createHash, timingSafeEqual } from "node:crypto";

export const KINDS = Object.freeze([
  "CONTENT_VARIATION", "AUTHORIZED_PUBLISHING", "UGC_PRODUCTION", "CONTENT_REPORTING",
]);
export const PLATFORMS = Object.freeze(["INSTAGRAM", "TIKTOK", "YOUTUBE", "X", "MULTI"]);
export const STATES = Object.freeze([
  "DRAFT", "READY_FOR_OPERATOR", "IN_PROGRESS", "DELIVERED", "REVIEW_REQUIRED", "CANCELLED",
]);
const transitions = Object.freeze({
  DRAFT: new Set(["READY_FOR_OPERATOR", "CANCELLED"]),
  READY_FOR_OPERATOR: new Set(["IN_PROGRESS", "REVIEW_REQUIRED", "CANCELLED"]),
  IN_PROGRESS: new Set(["DELIVERED", "REVIEW_REQUIRED"]),
  REVIEW_REQUIRED: new Set(["IN_PROGRESS", "CANCELLED"]),
  DELIVERED: new Set([]),
  CANCELLED: new Set([]),
});

export const canTransition = (from, to) => transitions[from]?.has(to) === true;
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function secureEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function validHttpsUrl(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.hash && !url.port && Boolean(url.hostname) &&
      !/^(localhost|.*\.localhost|.*\.local|[0-9.]+)$/i.test(url.hostname);
  } catch { return false; }
}

export function parseSpec(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("Specification required");
  const kind = String(raw.kind || "").trim().toUpperCase();
  const platform = String(raw.platform || "").trim().toUpperCase();
  const brief = typeof raw.brief === "string" ? raw.brief.trim() : "";
  const sourceAssetUrl = typeof raw.sourceAssetUrl === "string" ? raw.sourceAssetUrl.trim() : "";
  const deliverables = raw.deliverables;
  if (!KINDS.includes(kind) || !PLATFORMS.includes(platform)) throw new TypeError("Unsupported service kind/platform");
  if (brief.length < 10 || brief.length > 2000) throw new TypeError("Provide a 10-2000 character brief");
  if (!Number.isSafeInteger(deliverables) || deliverables < 1 || deliverables > 30) throw new TypeError("Invalid deliverable count");
  if (sourceAssetUrl && !validHttpsUrl(sourceAssetUrl)) throw new TypeError("Source asset must be an HTTPS URL");
  if (kind === "CONTENT_VARIATION" && !sourceAssetUrl) throw new TypeError("Content variation needs an authorized source asset");
  if (raw.clientAuthorized !== true) throw new TypeError("Client authorization required");
  // Deliberately omit provider order IDs, fake engagement counts, authentication credentials and passwords.
  return Object.freeze({ kind, platform, brief, sourceAssetUrl, deliverables, clientAuthorized: true });
}

export function normalizeSourceId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^[a-zA-Z0-9_-]{8,120}$/.test(id) ? id : null;
}

export function normalizeEvidence(value) {
  if (!validHttpsUrl(value)) throw new TypeError("HTTPS delivery evidence URL required");
  return value;
}

export function fingerprint(orderId, spec) {
  const id = normalizeSourceId(orderId);
  if (!id) throw new TypeError("Valid source order ID required");
  return sha256(JSON.stringify({ orderId: id, spec: parseSpec(spec) }));
}
