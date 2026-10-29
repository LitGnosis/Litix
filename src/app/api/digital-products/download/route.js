import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
});

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "Invalid download link." }, 400);

  const databaseUrl = process.env.LITIX_DIGITAL_DATABASE_URL;
  if (!databaseUrl) return json({ error: "Download service is temporarily unavailable." }, 503);
  const tokenHash = createHash("sha256").update(token).digest("hex");

  try {
    const sql = neon(databaseUrl);
    const orders = await sql.query(
      "select id, product_id, payment_state, fulfillment_state, entitlement_expires_at, download_count, max_downloads from litix_digital_orders where entitlement_token_hash = $1 limit 1",
      [tokenHash],
    );
    const order = orders[0];
    if (!order || order.payment_state !== "paid" || !["ready", "delivered"].includes(order.fulfillment_state)) {
      return json({ error: "This download is not available." }, 404);
    }
    if (order.entitlement_expires_at && new Date(order.entitlement_expires_at).getTime() <= Date.now()) {
      return json({ error: "This download link has expired. Contact support for help." }, 410);
    }

    const assets = await sql.query(
      "select file_name, content_type, content_base64, sha256 from litix_digital_assets where product_id = $1 and is_active = true limit 1",
      [order.product_id],
    );
    const asset = assets[0];
    if (!asset || asset.content_type !== "application/zip") {
      return json({ error: "The product file is temporarily unavailable. Contact support." }, 503);
    }

    const bytes = Buffer.from(asset.content_base64, "base64");
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== String(asset.sha256).trim()) {
      console.error("Digital product asset integrity check failed", order.product_id);
      return json({ error: "The product file failed an integrity check. Contact support." }, 503);
    }

    const updated = await sql.query(
      "update litix_digital_orders set download_count = download_count + 1, fulfillment_state = case when download_count + 1 >= max_downloads then 'delivered' else 'ready' end, updated_at = now() where id = $1 and payment_state = 'paid' and fulfillment_state in ('ready','delivered') and (entitlement_expires_at is null or entitlement_expires_at > now()) and download_count < max_downloads returning download_count, max_downloads",
      [order.id],
    );
    if (!updated.length) return json({ error: "Download limit reached or link expired." }, 410);

    const fileName = /^[A-Za-z0-9._-]{1,120}\.zip$/.test(asset.file_name) ? asset.file_name : "litix-digital-kit.zip";
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="' + fileName + '"',
        "content-length": String(bytes.length),
        "cache-control": "private, no-store, max-age=0",
        pragma: "no-cache",
        expires: "0",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("Digital download failed", String(error?.message || "database error").slice(0, 120));
    return json({ error: "Download service is temporarily unavailable." }, 503);
  }
}
