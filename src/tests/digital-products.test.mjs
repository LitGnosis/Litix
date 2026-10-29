import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const exists = (path) => access(new URL(path, import.meta.url));
const csvColumnCount = (row) => {
  let columns = 1;
  let quoted = false;
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] === '"' && row[i + 1] === '"') { i += 1; continue; }
    if (row[i] === '"') { quoted = !quoted; continue; }
    if (row[i] === "," && !quoted) columns += 1;
  }
  assert.equal(quoted, false, "CSV row should not contain an unclosed quoted field");
  return columns;
};

test("all three digital product source kits exist and contain substantive content", async () => {
  const files = [
    "../content/digital-products/creator-launch-kit/README.md",
    "../content/digital-products/social-growth-toolkit/README.md",
    "../content/digital-products/agency-starter-pack/README.md",
  ];
  for (const file of files) {
    const body = await read(file);
    assert.ok(body.length > 2500, `${file} should contain useful product content`);
    assert.match(body, /^# /);
  }
});

test("spreadsheet-ready templates have consistent CSV column counts", async () => {
  const files = [
    "../content/digital-products/creator-launch-kit/30-day-content-planner.csv",
    "../content/digital-products/social-growth-toolkit/experiment-tracker.csv",
    "../content/digital-products/social-growth-toolkit/monthly-dashboard.csv",
    "../content/digital-products/agency-starter-pack/client-project-tracker.csv",
    "../content/digital-products/agency-starter-pack/client-status-report.csv",
  ];
  for (const file of files) {
    const body = await read(file);
    const rows = body.trim().split(/\r?\n/);
    const headerColumns = csvColumnCount(rows[0]);
    assert.ok(headerColumns >= 5, `${file} should have useful spreadsheet columns`);
    for (const [index, row] of rows.slice(1).entries()) {
      assert.equal(csvColumnCount(row), headerColumns, `${file} row ${index + 2} has inconsistent columns`);
    }
  }
});

test("each planned product has a dedicated detail page and early-access form", async () => {
  const details = await read("../app/digital-products/[slug]/page.jsx");
  const form = await read("../app/digital-products/EarlyAccessForm.jsx");
  const signup = await read("../app/api/digital-products/early-access/route.js");
  assert.match(details, /generateStaticParams/);
  assert.match(details, /notFound\(\)/);
  assert.match(details, /Frequently asked questions/);
  assert.match(form, /type="email"/);
  assert.match(form, /required/);
  assert.match(signup, /LITIX_DIGITAL_WAITLIST_ENABLED !== "true"/);
});

test("storefront makes non-purchasable status explicit", async () => {
  const page = await read("../app/digital-products/page.jsx");
  assert.match(page, /Each kit page shows whether secure checkout is open/i);
  assert.match(page, /planned one-time price/i);
  assert.doesNotMatch(page, /fetch\(["'\x60].*checkout/i);
});

test("digital order schema keeps payment and fulfillment states constrained", async () => {
  const schema = await read("../db/migrations/20261029_digital_products.sql");
  assert.match(schema, /UNIQUE/);
  assert.match(schema, /payment_state='paid'/);
  assert.match(schema, /entitlement_token_hash/);
  assert.match(schema, /Do not store full card numbers, CVVs, raw payment tokens/i);
});

test("sales and private asset routes are fail-closed", async () => {
  const checkout = await read("../app/api/digital-products/checkout/route.js");
  const config = await read("../app/api/digital-products/config/route.js");
  const upload = await read("../app/api/digital-products/admin/assets/route.js");
  const download = await read("../app/api/digital-products/download/route.js");
  const revoke = await read("../app/api/digital-products/admin/orders/[id]/revoke/route.js");
  assert.match(checkout, /LITIX_DIGITAL_SALES_ENABLED !== "true"/);
  assert.match(checkout, /on conflict \(idempotency_key\) do nothing/);
  assert.match(checkout, /payment_state='review'/);
  assert.match(checkout, /payment_state='paid'/);
  assert.match(config, /LITIX_DIGITAL_SALES_ENABLED === "true"/);
  assert.match(upload, /LITIX_DIGITAL_ASSET_UPLOAD_ENABLED !== "true"/);
  assert.match(upload, /timingSafeEqual/);
  assert.match(download, /entitlement_token_hash/);
  assert.match(download, /download_count < max_downloads/);
  assert.match(download, /cache-control/);
  assert.match(revoke, /LITIX_DIGITAL_ADMIN_ACTIONS_ENABLED !== "true"/);
  assert.match(revoke, /chargeback_access_revoked/);
  assert.match(revoke, /fulfillment_state=.{0,10}revoked/);
});

test("waitlist is gated and supports confirmation plus unsubscribe", async () => {
  const signup = await read("../app/api/digital-products/early-access/route.js");
  const unsubscribe = await read("../app/api/digital-products/unsubscribe/route.js");
  const schema = await read("../db/migrations/20261029_digital_products.sql");
  assert.match(signup, /LITIX_DIGITAL_WAITLIST_ENABLED !== "true"/);
  assert.match(signup, /RESEND_API_KEY/);
  assert.match(signup, /unsubscribeUrl/);
  assert.match(unsubscribe, /unsubscribe_token_hash/);
  assert.match(schema, /unsubscribe_token_hash char\(64\) UNIQUE/);
});

test("product policy and release plan are present", async () => {
  await exists("../content/digital-products/DIGITAL_PRODUCT_RELEASE_PLAN.md");
  await exists("../content/digital-products/DIGITAL_PRODUCT_POLICY_DRAFT.md");
});
