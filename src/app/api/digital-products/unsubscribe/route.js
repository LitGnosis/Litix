import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const page = (title, message) => new Response(
  "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + title + " | Litix</title><body style=\"margin:0;background:#030712;color:#f4f7ff;font:16px/1.7 Arial,sans-serif;display:grid;min-height:100vh;place-items:center\"><main style=\"max-width:560px;padding:32px\"><p style=\"color:#38bdf8;font-weight:bold;letter-spacing:.16em\">LITIX DIGITAL WORKSHOP</p><h1>" + title + "</h1><p>" + message + "</p><a style=\"color:#facc15\" href=\"https://litix.net/digital-products\">Return to Litix</a></main></body></html>",
  { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } },
);

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return page("Invalid link", "This unsubscribe link is invalid or incomplete.");
  }
  const databaseUrl = process.env.LITIX_DIGITAL_DATABASE_URL;
  if (!databaseUrl) {
    return page("Temporarily unavailable", "We couldn't process your request right now. Please try again later.");
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    const sql = neon(databaseUrl);
    const rows = await sql.query(
      "update litix_digital_waitlist set unsubscribed_at = now(), updated_at = now(), unsubscribe_token_hash = null where unsubscribe_token_hash = $1 and unsubscribed_at is null returning id",
      [tokenHash],
    );
    if (!rows.length) {
      return page("Already handled", "This link has already been used or is no longer valid. If you still receive launch emails, contact Litix support.");
    }
    return page("You're unsubscribed", "You won't receive further Litix digital-product launch emails at this address.");
  } catch {
    return page("Temporarily unavailable", "We couldn't process your request right now. Please try again later.");
  }
}
