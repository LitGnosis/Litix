import { strict as assert } from "node:assert";
import test from "node:test";
import { buildNativeGrowthKit, GROWTH_CHANNELS, safeCampaignUrl } from "../lib/litixNativeGrowthEngine.mjs";

const brief = {
  brand: "Litix",
  campaign: "verified-business-growth",
  audience: "independent local business owners",
  pain: "missed leads and scattered social media content planning",
  solution: "an organized, reviewed social content strategy with tracked links",
  cta: "Request your campaign plan",
  landingUrl: "https://www.litix.net/agency-growth"
};

test("Litix can directly generate twelve first-party creative drafts", () => {
  const kit = buildNativeGrowthKit(brief);
  assert.equal(kit.variants.length, 12);
  assert.equal(new Set(kit.variants.map(v => v.id)).size, 12);
  assert.equal(GROWTH_CHANNELS.length, 4);
  for (const v of kit.variants) {
    assert.equal(v.published, false);
    assert.equal(v.videoRendered, false);
    assert.match(v.status, /DRAFT/);
    assert.match(v.trackingUrl, /utm_source=/);
    assert.match(v.trackingUrl, /utm_medium=organic_social/);
  }
  assert.match(kit.disclosure, /No video was edited/);
});

test("first-party creative drafts reject malformed input or unsafe destination", () => {
  assert.equal(safeCampaignUrl("http://example.com"), null);
  assert.equal(safeCampaignUrl("https://localhost/"), null);
  assert.throws(() => buildNativeGrowthKit({ ...brief, landingUrl: "http://example.com" }));
  assert.throws(() => buildNativeGrowthKit({ ...brief, solution: "" }));
});

test("existing native creative module has no paid or external engagement dispatch", () => {
  const output = buildNativeGrowthKit(brief);
  assert.equal(output.variants.every(x => x.published === false), true);
  assert.equal(output.variants.every(x => typeof x.caption === "string" && x.caption.length > 0), true);
});
