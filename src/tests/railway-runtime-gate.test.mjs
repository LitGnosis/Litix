import test from "node:test";
import assert from "node:assert/strict";
import { isApprovedProductionCheckoutRuntime as approved } from "../lib/railwayRuntime.mjs";

test("existing Vercel production behavior remains unchanged", () => {
  assert.equal(approved({ VERCEL_ENV: "production" }), true);
});
test("Railway requires explicit owner release approval", () => {
  assert.equal(approved({ RAILWAY_ENVIRONMENT_NAME: "production" }), false);
  assert.equal(approved({ RAILWAY_ENVIRONMENT_NAME: "preview", LITIX_RAILWAY_PRODUCTION_CHECKOUT_APPROVED: "true" }), false);
  assert.equal(approved({ RAILWAY_ENVIRONMENT_NAME: "production", LITIX_RAILWAY_PRODUCTION_CHECKOUT_APPROVED: "false" }), false);
  assert.equal(approved({ RAILWAY_ENVIRONMENT_NAME: "production", LITIX_RAILWAY_PRODUCTION_CHECKOUT_APPROVED: "true" }), true);
});
