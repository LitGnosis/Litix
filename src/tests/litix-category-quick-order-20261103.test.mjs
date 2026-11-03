import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SHOP_CATEGORIES,shopCategory} from "../lib/litixShopRoutes.mjs";
import {litixRetailPer1000Cents,litixOrderCents} from "../lib/litixRetail60.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const component=read("components/LitixCategoryQuickOrder.jsx");
const category=read("app/shop/[platform]/[kind]/page.jsx");
const home=read("app/page.jsx");
const handler=read("lib/boosteroOrderHandler.mjs");

test("every published category route renders quick order before full directory",()=>{
 assert.ok(SHOP_CATEGORIES.length>15);
 assert.match(category,/import LitixCategoryQuickOrder/);
 assert.ok(category.indexOf("<LitixCategoryQuickOrder ")<category.indexOf("<LitixDirectory standalone"));
 for(const c of SHOP_CATEGORIES)assert.equal(shopCategory(c.slug,c.kind)?.href,c.href);
});

test("only live-validated purchasable service choices can proceed",()=>{
 assert.match(component,/purchasable===true/);
 assert.ok(component.includes("^litix_"));
 assert.match(component,/ready:"true"/);
 assert.match(component,/platform,kind/);
 assert.match(component,/!response\.ok/);
 assert.match(component,/No verified packages/);
 assert.match(component,/Retry packages/);
});

test("quantity presets and direct links are checked locally before checkout",()=>{
 assert.match(component,/presets=\[100,500,1000,2500,5000,10000\]/);
 assert.match(component,/Number\.isSafeInteger\(quantity\)/);
 assert.match(component,/quantity>=Number\(selected\.min\)/);
 assert.match(component,/quantity<=Number\(selected\.max\)/);
 assert.match(component,/total>=100/);
 assert.match(component,/\&quantity=/);
 assert.match(component,/#checkout/);
 assert.match(home,/get\("quantity"\)/);
 assert.match(home,/quantityValid\?requestedQuantity:chosen\.min/);
});

test("pricing examples use the same cent rounding as checkout quotes",()=>{
 const likes={name:"Instagram Likes",category:"Instagram Likes"};
 const retail=litixRetailPer1000Cents(1.23,likes);
 assert.equal(retail,600); // $6 floor, greater than supplier 1.6x markup
 assert.equal(litixOrderCents(retail,500),300);
 const q=1250;
 const shown=Math.ceil((retail/100)*q/1000*100-1e-8);
 assert.equal(shown,litixOrderCents(retail,q));
});

test("all payment and supplier operations are still solely server-side",()=>{
 for(const disallowed of ["NMI_SECURITY_KEY","paymentToken","boosteroProduction(","/api/checkout/v1","/api/internal/boostero/","/api/paykings"])
  assert.ok(!component.includes(disallowed),"read-only quick order references "+disallowed);
 assert.match(handler,/expectedAmountCents/);
 assert.match(handler,/verifyBoosteroQuote/);
 assert.match(handler,/idempotencyKey/);
 assert.match(home,/fetch\("\/api\/checkout\/v1"/);
});

test("Custom Likes multi-post option remains discoverable",()=>{
 assert.match(component,/kind==="likes"/);
 assert.match(component,/href="\/custom-likes"/);
 assert.match(read("components/LitixCustomHub.jsx"),/Choose Instagram Posts/);
});
