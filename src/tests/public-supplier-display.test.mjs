import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Litix storefront never renders raw supplier service IDs", () => {
  const page = read("../app/page.jsx");
  assert.doesNotMatch(page, /#\{s\.id\}|#\{selected\.id\}/);
  assert.match(page, /sortServicesPer1000\(services\.filter/);
  assert.match(page, /serviceId:selected\.id/); // private checkout mapping remains intact
});

test("Customer tracking views and public tracking endpoints redact supplier identifiers", () => {
  const page = read("../app/track/page.jsx");
  const external = read("../app/api/track/route.js");
  const internal = read("../app/api/internal/boostero/track/route.js");
  assert.doesNotMatch(page, /Supplier order #|supplierOrderId/);
  assert.doesNotMatch(external, /supplierOrderId|Latest saved Boostero/);
  assert.doesNotMatch(internal, /supplier:"Boostero"|supplierOrderId:/);
  assert.match(external, /liveSupplierStatus:false/);
  assert.match(internal, /supplierStatus:x\.supplier_status/);
});
