import test from "node:test";
import assert from "node:assert/strict";
import { isBlockedRailwayPreviewRequest as blocked } from "../lib/railwayPreviewGuard.mjs";
const preview = { RAILWAY_PROJECT_ID: "prj-preview", RAILWAY_MIGRATION_READONLY: "true" };
const liveVercel = { VERCEL_ENV: "production" };
test("Railway preview denies all mutation methods", () => {
  for (const method of ["POST","PUT","PATCH","DELETE","OPTIONS"]) {
    assert.equal(blocked({ env: preview, pathname: "/api/checkout/v1", method }), true);
  }
});
test("Railway preview denies GET cron, supplier, webhook and order endpoints", () => {
  for (const pathname of ["/api/autolikes/cron","/api/bundles/cron","/api/checkout/settlement/cron","/api/internal/boostero/cron","/api/checkout/v1","/api/track"]) {
    assert.equal(blocked({ env: preview, pathname, method: "GET" }), true);
  }
});
test("Railway preview allows only read-only HTTP probes and static page GET", () => {
  for (const pathname of ["/api/status","/api/fulfillment/health","/api/checkout/readiness","/"]) {
    assert.equal(blocked({ env: preview, pathname, method: "GET" }), false);
  }
});
test("Vercel production behavior remains unchanged", () => {
  assert.equal(blocked({ env: liveVercel, pathname: "/api/checkout/v1", method: "POST" }), false);
  assert.equal(blocked({ env: liveVercel, pathname: "/api/autolikes/cron", method: "GET" }), false);
});
