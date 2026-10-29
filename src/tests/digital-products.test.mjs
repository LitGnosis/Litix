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

test("storefront makes non-purchasable status explicit", async () => {
  const page = await read("../app/digital-products/page.jsx");
  assert.match(page, /not yet available for purchase/i);
  assert.match(page, /one-time price concept/i);
  assert.doesNotMatch(page, /fetch\(["'\x60].*checkout/i);
});

test("digital order schema keeps payment and fulfillment states constrained", async () => {
  const schema = await read("../db/migrations/20261029_digital_products.sql");
  assert.match(schema, /UNIQUE/);
  assert.match(schema, /payment_state='paid'/);
  assert.match(schema, /entitlement_token_hash/);
  assert.match(schema, /Do not store full card numbers, CVVs, raw payment tokens/i);
});

test("product policy and release plan are present", async () => {
  await exists("../content/digital-products/DIGITAL_PRODUCT_RELEASE_PLAN.md");
  await exists("../content/digital-products/DIGITAL_PRODUCT_POLICY_DRAFT.md");
});
