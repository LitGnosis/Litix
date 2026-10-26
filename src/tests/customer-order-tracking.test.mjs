import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const source = read("app/api/account/order-status/route.js")
  .replace('import { neon } from "@neondatabase/serverless";', 'const neon = () => globalThis.__litixOrderDb;')
  .replace('import { authenticatedCustomer, customerAuthConfigured } from "../../../../lib/customerAuth.js";',
    'const authenticatedCustomer = async () => globalThis.__litixOrderUser; const customerAuthConfigured = () => globalThis.__litixAuthOn;');

const ID = "ltx2_00000000-0000-4000-8000-000000000001";
const OWN = "verified@example.test";
const order = (overrides = {}) => ({
  id: ID, service_name: "Instagram followers", quantity: 1000, amount_cents: 699,
  payment_state: "paid", fulfillment_state: "processing", supplier_order_id: "1234567",
  last_supplier_status: { status: "Processing", remains: 0, checked_at: new Date().toISOString() },
  ...overrides
});

test("logged-in order tracking is scoped to the verified customer, and never reveals tokens", async t => {
  const oldFetch = globalThis.fetch;
  const oldDb = globalThis.__litixOrderDb, oldUser = globalThis.__litixOrderUser, oldAuth = globalThis.__litixAuthOn;
  const oldURL = process.env.LITIX_V2_DATABASE_URL, oldSupplierKey = process.env.SMMGLOB_API_KEY;
  t.after(() => {
    globalThis.fetch = oldFetch;
    globalThis.__litixOrderDb = oldDb;
    globalThis.__litixOrderUser = oldUser;
    globalThis.__litixAuthOn = oldAuth;
    if (oldURL === undefined) delete process.env.LITIX_V2_DATABASE_URL; else process.env.LITIX_V2_DATABASE_URL = oldURL;
    if (oldSupplierKey === undefined) delete process.env.SMMGLOB_API_KEY; else process.env.SMMGLOB_API_KEY = oldSupplierKey;
  });
  globalThis.__litixAuthOn = false;
  globalThis.__litixOrderUser = null;
  process.env.LITIX_V2_DATABASE_URL = "postgres://mock-user:mock-password@example.invalid/staging";
  process.env.SMMGLOB_API_KEY = "mock-supplier-key";
  let dbCalls = [];
  let rows = [order()];
  globalThis.__litixOrderDb = { query: async (sql, params) => {
    dbCalls.push({ sql, params });
    if (sql.startsWith("select")) return rows;
    return [];
  }};
  let upstreamCalls = [];
  globalThis.fetch = async (_url, opts) => {
    upstreamCalls.push(opts);
    return Response.json({ status: "In progress", remains: 500 });
  };
  const { GET } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  const request = id => GET(new Request("https://example.test/api/account/order-status?id=" + encodeURIComponent(id)));
  assert.equal((await request(ID)).status, 503, "disabled login fails closed");
  globalThis.__litixAuthOn = true;
  assert.equal((await request(ID)).status, 401, "no session cannot read orders");
  assert.equal(dbCalls.length, 0, "no unauthenticated database access");
  globalThis.__litixOrderUser = { id: "auth0|synthetic", email: OWN, name: "Test" };
  assert.equal((await request("wrong-id")).status, 400);
  assert.equal(dbCalls.length, 0, "invalid identifier does not query database");
  rows = [];
  assert.equal((await request(ID)).status, 404, "unknown and non-owned orders share 404");
  assert.deepEqual(dbCalls[0].params, [ID, OWN], "query binds both order and verified identity");
  assert.match(dbCalls[0].sql, /lower\(email\)=\$2/);
  rows = [order()];
  const cached = await request(ID);
  assert.equal(cached.status, 200);
  assert.equal(cached.headers.get("cache-control"), "no-store");
  const payload = await cached.json();
  assert.equal(payload.order.payment, "paid");
  assert.equal(payload.order.fulfillment, "processing");
  assert.equal(payload.order.remains, 0);
  assert.equal(payload.order.deliveryConfirmed, false, "zero remaining does not imply delivery completed");
  assert.equal(upstreamCalls.length, 0, "recent supplier state is cached for one minute");
  assert.equal(JSON.stringify(payload).includes(OWN), false);
  assert.equal(JSON.stringify(payload).includes("token"), false);

  rows = [order({ last_supplier_status: { status: "Processing", remains: 700, checked_at: "2026-01-01T00:00:00Z" } })];
  const fresh = await request(ID);
  assert.equal(fresh.status, 200);
  const updated = await fresh.json();
  assert.equal(updated.order.fulfillment, "in_progress");
  assert.equal(updated.order.remains, 500);
  assert.equal(updated.order.liveSupplierStatus, true);
  assert.equal(updated.order.deliveryConfirmed, false);
  assert.equal(upstreamCalls.length, 1);
  assert.equal(upstreamCalls[0].method, "POST");
  assert.equal(upstreamCalls[0].body.get("action"), "status", "never submits a supplier order");
  assert.equal(upstreamCalls[0].body.get("order"), "1234567");
  assert.ok(dbCalls.some(c => c.sql.startsWith("update") && c.params[0] === ID && c.params[1] === OWN));
  globalThis.fetch = async () => { throw Error("Supplier temporarily unavailable"); };
  rows = [order({ last_supplier_status: { status: "Processing", remains: 700, checked_at: "2026-01-01T00:00:00Z" } })];
  const stale = await (await request(ID)).json();
  assert.equal(stale.order.fulfillment, "processing");
  assert.equal(stale.order.liveSupplierStatus, false);
  assert.match(stale.order.statusNote, /temporarily unavailable/);
});

test("dashboard, tracker and confirmation provide direct and safe links", () => {
  const dashboard = read("app/account/AccountClient.jsx");
  const tracker = read("app/track/page.jsx");
  const confirmation = read("app/confirmation/page.jsx");
  assert.match(dashboard, /Track this order/);
  assert.match(tracker, /kind:"account",id:providedId/);
  assert.match(tracker, /api\/account\/order-status\?id=/);
  assert.match(tracker, /if\(response\.status===401\)/);
  assert.match(tracker, /api\/track\?id=/, "guest private token tracking preserved");
  assert.match(tracker, /api\/order-lookup/, "guest checkout email tracking preserved");
  assert.match(confirmation, /href=\{receipt\.trackingUrl\}/, "guest confirmation links directly to private tracker");
  const checkout = read("app/api/[action]/route.js");
  assert.match(checkout, /selectedGatewayMode\(\)==="TEST"/);
  assert.match(checkout, /on conflict\(idempotency_key\) do nothing/);
  assert.match(checkout, /payment\.response\)!=="1"/);
});
