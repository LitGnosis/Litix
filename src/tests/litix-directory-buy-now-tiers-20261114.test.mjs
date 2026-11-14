import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {checkoutDisplay,QUANTITY_PRESETS} from "../lib/litixCheckoutDisplay.mjs";
import {litixPublicCard} from "../lib/publicLitixCatalog.mjs";

const source=path=>readFile(new URL(path,import.meta.url),"utf8");
const sample=(id,rate)=>({
 id,platform:"Instagram",kind:"followers",
 name:"Instagram Followers",category:"Instagram - USA Services",
 min:90,max:5000,per1000:rate,unitStep:1,purchasable:true
});

test("directory tier chip uses verified source descriptions, not invented quality claims",()=>{
 const expected=[
  ["litix_2132",11.02,"High quality · Up to 4,000/day"],
  ["litix_3474",14.37,"Premium quality · Up to 5,000/day"],
  ["litix_5093",19.32,"Real-Look Profiles · Up to 5,000/day"],
  ["litix_2133",19.33,"Premium Active Profiles · Up to 1,000/day"],
  ["litix_2131",19.34,"Premium Active Profiles · Up to 2,000/day"]
 ];
 for(const [id,rate,label] of expected){
  const service=sample(id,rate);
  const projected=litixPublicCard(service);
  assert.equal(projected.id,id);
  assert.equal(projected.per1000,rate);
  assert.equal(checkoutDisplay(projected).tierLabel,label,id);
 }
 const unknown=checkoutDisplay(sample("litix_77777777",11.02));
 assert.equal(unknown.tierLabel,"");
 assert.match(unknown.subtitle,/Standard service · 90–5,000 limit/);
 assert.doesNotMatch(unknown.subtitle,/guarantee|refill|instant delivery/i);
});

test("Buy Now is the only changed ordinary catalog CTA copy",async()=>{
 const [directory,style,display]=await Promise.all([
  source("../components/LitixDirectory.jsx"),
  source("../app/catalog.css"),
  source("../lib/litixCheckoutDisplay.mjs")
 ]);
 assert.match(directory,/className="litix-directory-buy" href=\{"\/\?service="\+encodeURIComponent\(s\.id\)/);
 assert.match(directory,/\?"Choose Your Posts":"BUY NOW"/);
 assert.doesNotMatch(directory,/Review & pay with PayKings/);
 assert.match(directory,/const tierLabel=checkoutDisplay\(s\)\.tierLabel/);
 assert.match(directory,/className="litix-directory-service-tier"/);
 assert.match(directory,/className="litix-directory-service-category"/);
 assert.match(directory,/currency\(s\.per1000\)/);
 assert.match(directory,/s\.min\.toLocaleString\(\)\+"–"\+s\.max\.toLocaleString\(\)/);
 assert.match(style,/\.litix-directory-buy\{background:linear-gradient\(100deg,#aee7ff,#39a9e6\);color:#04263d\}/);
 assert.match(style,/\.litix-directory-service-tier\{/);
 assert.match(display,/return \{title,subtitle,tierLabel,specialty/);
 assert.deepEqual(QUANTITY_PRESETS,[250,500,1000,2500,5000]);
});
