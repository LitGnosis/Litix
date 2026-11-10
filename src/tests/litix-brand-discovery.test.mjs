import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 LITIX_SITE_URL,LITIX_DISCOVERY_TITLE,LITIX_DISCOVERY_DESCRIPTION,LITIX_DISCOVERY_SCHEMA
} from "../lib/litixBrandDiscovery.mjs";
const source=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("organization and website schema use publicly supportable first-party facts",()=>{
 assert.equal(LITIX_SITE_URL,"https://www.litix.net/");
 assert.match(LITIX_DISCOVERY_TITLE,/Litix/);
 assert.match(LITIX_DISCOVERY_DESCRIPTION,/customer order tracking/);
 const nodes=LITIX_DISCOVERY_SCHEMA["@graph"];
 const org=nodes.find(n=>n["@type"]==="Organization");
 const site=nodes.find(n=>n["@type"]==="WebSite");
 assert.ok(org&&site);
 assert.equal(org.name,"Litix");
 assert.equal(org.logo,"https://www.litix.net/assets/brand/litix-logo.webp");
 assert.equal(org.email,"litixsocial@gmail.com");
 assert.equal(site.publisher["@id"],org["@id"]);
 assert.equal(site.url,LITIX_SITE_URL);
 assert.equal("rating" in org,false);
 assert.equal("aggregateRating" in org,false);
 assert.equal("sameAs" in org,false);
 assert.doesNotMatch(JSON.stringify(nodes),/guaranteed|6x ROI|numberOne|top rated/i);
});
test("app layout embeds schema and descriptive search metadata",()=>{
 const layout=source("app/layout.jsx");
 assert.match(layout,/LITIX_DISCOVERY_SCHEMA/);
 assert.match(layout,/type="application\/ld\+json"/);
 assert.match(layout,/JSON\.stringify\(schema\)/);
 assert.match(layout,/LITIX_DISCOVERY_TITLE/);
 assert.match(layout,/LITIX_DISCOVERY_DESCRIPTION/);
});
test("about and editorial pages are factual with no invented media placements",()=>{
 const about=source("app/company/page.jsx"),press=source("app/press/page.jsx");
 assert.match(about,/Litix\.net/);
 assert.match(about,/New AutoLikes purchases are currently paused/);
 assert.match(about,/No\. Marketing outcomes/);
 assert.match(press,/not.*independent review/);
 assert.match(press,/not.*media coverage/);
 assert.match(press,/litixsocial@gmail\.com/);
 assert.match(press,/\/assets\/brand\/litix-logo\.webp/);
 assert.match(press,/verify|first-party|first.hand/i);
 assert.doesNotMatch(press,/featured in Forbes|featured on CNN|published in Fortune/);
});
test("factual resources linked from homepage and included in sitemap",()=>{
 const home=source("app/page.jsx"),map=source("app/sitemap.js"),robots=source("app/robots.js");
 assert.match(home,/href="\/company"/);
 assert.match(home,/href="\/press"/);
 assert.match(map,/base\+"\/company"/);
 assert.match(map,/base\+"\/press"/);
 assert.match(robots,/sitemap\.xml/);
});
