import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {VERIFIED_CHECKOUT_SEED} from "../lib/litixCheckoutVerifiedSeed.mjs";
import {choicesForPlatform,firstPackageFor,combineCheckoutChoices} from "../lib/litixCheckoutBootstrap.mjs";
import {FAST_CHECKOUT_MAX_RATE,checkoutDisplay,cleanCheckoutTitle,publicCheckoutTraits,
 dedupeCheckoutCards,defaultCheckoutQuantity,clampCheckoutQuantity,
 checkoutQuantityEligible,quoteCentsForQuantity,QUANTITY_PRESETS} from "../lib/litixCheckoutDisplay.mjs";
const source=path=>readFile(new URL(path,import.meta.url),"utf8");
const realId=id=>VERIFIED_CHECKOUT_SEED.items.find(x=>x.id===id);

test("USA Followers appear first and five genuinely different variants carry source-supported subtitles",()=>{
 const data=choicesForPlatform("Instagram");
 const all=data.items.filter(x=>x.kind==="followers");
 const five=all.filter(x=>x.name==="Instagram USA Followers");
 assert.deepEqual(five.map(x=>x.id),[
  "litix_2132","litix_3474","litix_5093","litix_2133","litix_2131"
 ]);
 assert.deepEqual(five.map(x=>x.per1000),[11.02,14.37,19.32,20.75,58.12]);
 const subtitles=five.map(checkoutDisplay).map(x=>x.subtitle);
 assert.equal(new Set(subtitles).size,5);
 assert.match(subtitles[0],/High quality.*Up to 4,000\/day/i);
 assert.match(subtitles[1],/Premium quality.*Up to 5,000\/day/i);
 assert.match(subtitles[2],/Real-Look Profiles.*Up to 5,000\/day/i);
 assert.match(subtitles[3],/Premium Active Profiles.*Up to 1,000\/day/i);
 assert.match(subtitles[4],/Premium Active Profiles.*Up to 2,000\/day/i);
 for(const s of subtitles)assert.doesNotMatch(s,/guarantee|refill|VIP|non.drop/i);
});

test("source parser differentiates true public traits without claiming unverified refills",()=>{
 const traits=publicCheckoutTraits("🇺🇸 Instagram USA Followers ➡️ [ Premium Quality | 5K/Day | 30 Days Manual Refill ]");
 assert.deepEqual(traits,{quality:"Premium quality",pace:"5K/Day listed"});
 assert.equal(cleanCheckoutTitle("🇨🇴 Instagram Columbia Followers"),"Instagram Colombia Followers");
 assert.equal(checkoutDisplay(realId("litix_2063")).title,"Instagram Colombia Followers");
 assert.doesNotMatch(checkoutDisplay(realId("litix_5093")).subtitle,/refill/i);
});

test("true duplicates collapse only if price, display traits, quantities and step are identical",()=>{
 const input=realId("litix_2132");
 const twin={...input,id:"litix_998877",variantQuality:"High quality",variantPace:"4K/day listed"};
 assert.equal(dedupeCheckoutCards([input,twin]).length,1);
 const diffPrice={...twin,per1000:14.37};
 const diffRange={...twin,max:9000};
 assert.equal(dedupeCheckoutCards([input,diffPrice,diffRange]).length,3);
 assert.equal(choicesForPlatform("Instagram",[input,twin]).items.length,1);
});

test("specialty $1,244.88 rate is not the default and has real 200-unit maximum",async()=>{
 const specialty=realId("litix_2145");
 assert.equal(specialty.max,200);
 assert.equal(checkoutDisplay(specialty).specialty,true);
 assert.ok(FAST_CHECKOUT_MAX_RATE<specialty.per1000);
 const first=firstPackageFor(choicesForPlatform("Instagram"),"followers");
 assert.equal(first.id,"litix_2132");
 assert.equal(defaultCheckoutQuantity(first),1000);
 assert.equal(quoteCentsForQuantity(first,1000),1102);
 assert.equal(defaultCheckoutQuantity(specialty)<=200,true);
 const ui=await source("../components/LitixCheckoutSelector.jsx");
 assert.match(ui,/Show Specialty \/ Custom options/);
 assert.match(ui,/visibleSpecialty&&specialty\.length>0/);
 assert.doesNotMatch(ui,/Choose a package"\s*:/);
});

test("quantity presets recompute cents correctly; custom inputs clamp to documented bounds and step",()=>{
 const regular=realId("litix_2132");
 for(const n of QUANTITY_PRESETS)assert.equal(checkoutQuantityEligible(regular,n),n<=regular.max);
 assert.equal(clampCheckoutQuantity(5000,regular),5000);
 assert.equal(clampCheckoutQuantity(999999,regular),5000);
 assert.equal(clampCheckoutQuantity(1,regular),91);
 assert.equal(quoteCentsForQuantity(regular,91),101);
 const specials={id:"litix_12345",min:100,max:1200,unitStep:50,per1000:12.50};
 assert.equal(clampCheckoutQuantity(1000,specials),1000);
 assert.equal(clampCheckoutQuantity(139,specials),100);
 assert.equal(clampCheckoutQuantity(1220,specials),1200);
 assert.equal(checkoutQuantityEligible(specials,125),false);
 assert.equal(checkoutQuantityEligible(specials,1000),true);
});

test("first paint selects USA variant and 1000 quantity with a USD total",async()=>{
 const page=await source("../app/page.jsx");
 const bootstrap=await source("../lib/litixCheckoutBootstrap.mjs");
 assert.match(page,/INITIAL_FAST_SERVICE=firstPackageFor\(INITIAL_FAST_CHOICES,"followers"\)/);
 assert.match(page,/\[selected,setSelected\]=useState\(INITIAL_FAST_SERVICE\)/);
 assert.match(page,/\[qty,setQty\]=useState\(INITIAL_FAST_QUANTITY\)/);
 assert.match(page,/className="litix-quantity-presets"/);
 assert.match(page,/aria-label="Custom quantity"/);
 assert.match(page,/onBlur=\{\(\)=>setQty\(clampCheckoutQuantity\(qty,selected\)\)\}/);
 assert.match(bootstrap,/dedupeCheckoutCards/);
 assert.match(bootstrap,/compareCheckoutCards/);
 assert.doesNotMatch(page,/href="#checkout">Checkout<\/a>/);
});

test("API and payment paths preserve exact service identity and amounts",async()=>{
 const api=await source("../lib/litixCheckoutChoices.mjs");
 const readiness=await source("../app/api/checkout/readiness/route.js");
 const ui=await source("../components/LitixCheckoutSelector.jsx");
 assert.match(api,/publicCheckoutTraits\(s\.name\)/);
 assert.match(readiness,/verifyBoosteroQuote\(serviceId,quantity\)/);
 assert.match(ui,/value=\{service\.id\}/);
 const original=realId("litix_2132");
 const combined=combineCheckoutChoices("Instagram",{items:[original]});
 assert.equal(combined.items[0].id,original.id);
 assert.equal(combined.items[0].per1000,original.per1000);
});
