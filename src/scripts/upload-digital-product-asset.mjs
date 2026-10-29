import { readFile } from "node:fs/promises";
import path from "node:path";

const [productId, version, filePath] = process.argv.slice(2);
const allowed = new Set(["creator-launch-kit", "social-growth-toolkit", "agency-starter-pack"]);
const baseUrl = process.env.LITIX_DIGITAL_ADMIN_BASE_URL;
const adminToken = process.env.LITIX_DIGITAL_ASSET_ADMIN_TOKEN;

if (!allowed.has(productId) || !/^[0-9A-Za-z._-]{1,32}$/.test(version || "") || !filePath) {
  console.error("Usage: node scripts/upload-digital-product-asset.mjs <product-id> <version> <bundle.zip>");
  process.exit(2);
}
if (!baseUrl || !adminToken) {
  console.error("Set LITIX_DIGITAL_ADMIN_BASE_URL and LITIX_DIGITAL_ASSET_ADMIN_TOKEN in your shell.");
  process.exit(2);
}

let base;
try {
  base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.pathname !== "/" || base.search || base.hash) throw new Error("Invalid base URL");
} catch {
  console.error("LITIX_DIGITAL_ADMIN_BASE_URL must be a valid HTTPS origin.");
  process.exit(2);
}

const fileName = path.basename(filePath);
if (!/^[A-Za-z0-9._-]{1,120}\.zip$/.test(fileName)) {
  console.error("The asset must have a safe .zip filename.");
  process.exit(2);
}
const bytes = await readFile(filePath);
if (bytes.length < 4 || bytes.length > 3_000_000 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
  console.error("The bundle must be a ZIP file no larger than 3 MB.");
  process.exit(2);
}

const response = await fetch(new URL("/api/digital-products/admin/assets", base), {
  method: "POST",
  headers: {
    authorization: "Bearer " + adminToken,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    productId,
    version,
    fileName,
    contentType: "application/zip",
    contentBase64: bytes.toString("base64"),
  }),
});
const result = await response.json().catch(() => ({}));
if (!response.ok || !result.ok) {
  console.error("Asset upload failed:", result.error || "HTTP " + response.status);
  process.exit(1);
}
console.log("Stored private bundle:", result.productId, "version", result.version, "bytes", result.bytes, "SHA-256", result.sha256);
