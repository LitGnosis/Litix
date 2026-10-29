import { createHash, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

const productIds = new Set(["creator-launch-kit", "social-growth-toolkit", "agency-starter-pack"]);

function authorized(request) {
  const expected = process.env.LITIX_DIGITAL_ASSET_ADMIN_TOKEN || "";
  const supplied = request.headers.get("authorization") || "";
  const match = supplied.match(/^Bearer\s+(.+)$/i);
  if (!expected || !match) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(match[1]);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request) {
  if (process.env.LITIX_DIGITAL_ASSET_UPLOAD_ENABLED !== "true") {
    return json({ error: "Private asset upload is disabled." }, 503);
  }
  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const productId = String(input.productId || "");
  const version = String(input.version || "").trim().slice(0, 32);
  const fileName = String(input.fileName || "");
  const contentType = String(input.contentType || "");
  const contentBase64 = String(input.contentBase64 || "");
  if (!productIds.has(productId) || !/^[0-9A-Za-z._-]{1,32}$/.test(version)) {
    return json({ error: "Invalid product or version." }, 400);
  }
  if (!/^[A-Za-z0-9._-]{1,120}\.zip$/.test(fileName) || contentType !== "application/zip") {
    return json({ error: "Only a named ZIP product bundle is accepted." }, 400);
  }
  if (!contentBase64 || contentBase64.length > 12_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)) {
    return json({ error: "Invalid or oversized asset." }, 413);
  }

  const bytes = Buffer.from(contentBase64, "base64");
  if (bytes.length < 4 || bytes.length > 8_000_000 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return json({ error: "Asset must be a valid-size ZIP file." }, 400);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const databaseUrl = process.env.LITIX_DIGITAL_DATABASE_URL;
  if (!databaseUrl) return json({ error: "Digital-products database is not configured." }, 503);

  try {
    const sql = neon(databaseUrl);
    await sql.query(
      "insert into litix_digital_assets (product_id, version, file_name, content_type, content_base64, sha256, is_active, updated_at) values ($1,$2,$3,$4,$5,$6,true,now()) on conflict (product_id) do update set version=excluded.version, file_name=excluded.file_name, content_type=excluded.content_type, content_base64=excluded.content_base64, sha256=excluded.sha256, is_active=true, updated_at=now()",
      [productId, version, fileName, contentType, contentBase64, sha256],
    );
    return json({ ok: true, productId, version, sha256, bytes: bytes.length });
  } catch (error) {
    console.error("Digital asset upload failed", String(error?.message || "database error").slice(0, 120));
    return json({ error: "Asset could not be stored." }, 503);
  }
}
