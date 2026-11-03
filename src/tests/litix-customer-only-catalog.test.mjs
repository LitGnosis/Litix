import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {litixPublicCard,litixPublicId,litixInternalId} from "../lib/publicLitixCatalog.mjs";
const code=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Litix-only public DTO removes supplier, economics, raw IDs and private markup policies",()=>{
 const item=litixPublicCard({
  id:"boostero_5251",name:"👍 TikTok Likes ➡️ [ High Quality | Non Drop | Boostero's Top Pick | 100K/Day ]",
  category:"TikTok Likes Boostero",platform:"TikTok",kind:"likes",type:"Default",
  min:918,max:100000,unitStep:1,per1000:1.09,startingAmountCents:101,
  supplierMin:10,purchasable:true,pricingReview:false,
  supplier:"Boostero",pricingPolicy:"Boostero live cost + 60% markup",markupPercent:60,
  wholesaleCents:89,supplierServiceId:"5251",secret:"never"
 });
 assert.equal(item.id,"litix_5251");
 assert.equal(item.purchasable,true);
 assert.equal(item.per1000,1.09);
 assert.equal(item.startingAmountCents,101);
 assert.deepEqual([litixPublicId("boostero_5251"),litixInternalId("litix_5251")],["litix_5251","boostero_5251"]);
 for(const forbidden of ["supplier","pricingPolicy","wholesaleCents","markupPercent","supplierMin","secret","supplierServiceId"])
  assert.equal(Object.hasOwn(item,forbidden),false);
 assert.doesNotMatch(JSON.stringify(item),/boostero|markup|wholesale|non.drop|top.pick/i);
});

test("checkout, service directory and tracking never disclose supplier costs and raw names",()=>{
 const home=code("app/page.jsx");
 const directory=code("components/LitixDirectory.jsx");
 const global=code("app/api/catalog/global/route.js");
 const catalog=code("lib/activeStorefrontCatalog.mjs");
 const checkout=code("app/api/checkout/v1/route.js");
 const tracking=code("app/api/internal/boostero/track/route.js");
 assert.doesNotMatch(home,/live supplier cost \+ 60% markup|calculated from current supplier rates plus 60% markup/i);
 assert.doesNotMatch(directory,/current wholesale rate plus a 60% markup/i);
 assert.doesNotMatch(global,/notice:"All displayed rates use supplier cost|markupPercent:60|source:"live_supplier_api"/);
 assert.doesNotMatch(catalog,/boosteroCatalogStatus:|boosteroOnly:true|markupPercent:60/);
 assert.match(catalog,/map\(litixPublicCard\)/);
 assert.match(global,/map\(litixPublicCard\)/);
 assert.match(checkout,/litix\|boostero/);
 assert.match(tracking,/service:publicServiceCardName/);
});
