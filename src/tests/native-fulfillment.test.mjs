import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canTransition, fingerprint, normalizeEvidence, normalizeSourceId,
  parseSpec, secureEqual, validHttpsUrl,
} from "../native/fulfillment-core.mjs";
import { PRESETS, buildCommand, repurpose } from "../native/repurpose-video.mjs";

const sample = Object.freeze({
  kind: "CONTENT_VARIATION", platform: "INSTAGRAM",
  brief: "Produce three original authorized short-form edits.",
  sourceAssetUrl: "https://cdn.example.com/source.mp4",
  deliverables: 3, clientAuthorized: true,
});

test("spec normalizes only supported content work and rejects unsanctioned requests", () => {
  assert.equal(parseSpec(sample).kind, "CONTENT_VARIATION");
  assert.equal(parseSpec({ ...sample, platform: "TIKTOK" }).platform, "TIKTOK");
  assert.throws(() => parseSpec({ ...sample, kind: "FOLLOWER_FARM" }), /Unsupported/);
  assert.throws(() => parseSpec({ ...sample, clientAuthorized: false }), /authorization/);
  assert.throws(() => parseSpec({ ...sample, sourceAssetUrl: "" }), /source asset/);
  assert.throws(() => parseSpec({ ...sample, deliverables: 999 }), /deliverable/);
  assert.throws(() => parseSpec({ ...sample, brief: "small" }), /brief/);
  assert.equal("paymentToken" in parseSpec({ ...sample, paymentToken: "untrusted" }), false);
});
test("HTTPS validation blocks local-only and credentialed URLs", () => {
  assert.equal(validHttpsUrl("https://cdn.example.com/ok"), true);
  for (const item of ["http://x.example/a", "https://127.0.0.1/a",
    "https://localhost/a", "https://thing.local/a", "https://bob:pw@site.com/a"]) {
    assert.equal(validHttpsUrl(item), false, item);
  }
  assert.throws(() => normalizeEvidence("http://example.com/proof"), /HTTPS/);
});
test("deterministic idempotency and secure token comparison", () => {
  const key = fingerprint("ltix_12345678", sample);
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.equal(key, fingerprint("ltix_12345678", { ...sample }));
  assert.notEqual(key, fingerprint("ltix_23456789", sample));
  assert.equal(normalizeSourceId("bad / id"), null);
  assert.equal(secureEqual("a-secret", "a-secret"), true);
  assert.equal(secureEqual("a-secret", "wrong"), false);
  assert.equal(secureEqual("", ""), false);
});
test("state machine prevents double delivery, duplicate dispatch, and review bypass", () => {
  assert.equal(canTransition("DRAFT", "READY_FOR_OPERATOR"), true);
  assert.equal(canTransition("DRAFT", "DELIVERED"), false);
  assert.equal(canTransition("READY_FOR_OPERATOR", "IN_PROGRESS"), true);
  assert.equal(canTransition("IN_PROGRESS", "REVIEW_REQUIRED"), true);
  assert.equal(canTransition("REVIEW_REQUIRED", "IN_PROGRESS"), true);
  assert.equal(canTransition("DELIVERED", "IN_PROGRESS"), false);
  assert.equal(canTransition("DELIVERED", "DELIVERED"), false);
});
test("video repurposing runs local FFmpeg without shell or platform publishing", async (t) => {
  assert.equal(PRESETS.length, 3);
  const args = buildCommand("/tmp/asset;rm -rf x.mp4", "/tmp/variant.mp4", PRESETS[0].filter);
  assert.equal(args[args.indexOf("-i") + 1], "/tmp/asset;rm -rf x.mp4");
  assert.equal(args.includes("-n"), true, "existing outputs are never overwritten");
  await assert.rejects(() => repurpose("/tmp/missing.mp4", "/tmp/out"), /authorized/);
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) return t.skip("FFmpeg not installed");
  const dir = mkdtempSync(join(tmpdir(), "litix-native-test-"));
  const source = join(dir, "sample.mp4"), out = join(dir, "variants");
  const generated = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi",
    "-i", "color=c=blue:s=96x128:d=0.2", "-pix_fmt", "yuv420p", source], { timeout: 30000 });
  assert.equal(generated.status, 0, String(generated.stderr));
  const variants = await repurpose(source, out, { authorized: true });
  assert.equal(variants.length, 3);
  assert.equal(readdirSync(out).filter(name => name.endsWith(".mp4")).length, 3);
});
test("new admin API cannot submit payments or upstream engagement orders", () => {
  const api = readFileSync(new URL("../app/api/internal/native-fulfillment/route.js", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../db/migrations/20261110-native-content-work-orders.sql", import.meta.url), "utf8");
  assert.match(api, /LITIX_NATIVE_FULFILLMENT_ENABLED/);
  assert.match(api, /LITIX_NATIVE_FULFILLMENT_ADMIN_TOKEN/);
  assert.match(api, /lower\(payment_state\)='settled'/);
  assert.match(api, /autoDispatchEnabled: false/);
  assert.doesNotMatch(api, /fetch\s*\(/);
  assert.match(migration, /litix_native_work_events/);
  assert.match(migration, /Invalid native work state change/);
});
