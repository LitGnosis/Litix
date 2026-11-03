import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const hub=read("app/custom-likes/page.jsx");
const home=read("app/page.jsx");
const orders=read("app/custom-orders/page.jsx");
const directory=read("components/LitixDirectory.jsx");
const chooser=read("components/SocialMultiPostChooser.jsx");
const backend=read("lib/boosteroOrderHandler.mjs");

test("Custom Likes navigation and two approved platform links are discoverable",()=>{
 assert.match(home,/href="\/custom-likes"/);
 assert.match(orders,/href="\/custom-likes"/);
 assert.match(directory,/href="\/custom-likes"/);
 assert.match(hub,/serviceId:"litix_4751"/);
 assert.match(hub,/serviceId:"litix_5251"/);
 assert.match(hub,/mode=multi#checkout/);
});
test("Deep links open the chooser only for selected approved likes",()=>{
 assert.match(home,/params\.get\("mode"\)==="multi"/);
 assert.match(home,/\["litix_4751","litix_5251"\]\.includes\(requested\)/);
 assert.match(home,/setMultiPostEnabled\(customLikesIntent\)/);
 assert.match(home,/newTikTokPost\(\{quantity:Number\(selected\?\.min\)\|\|1\}\)/);
 assert.match(home,/SocialMultiPostChooser/);
});
test("Service cards preserve one payment path and only use post mode for approved IDs",()=>{
 assert.match(directory,/\?service=/);
 assert.match(directory,/&mode=multi/);
 assert.match(directory,/Review & pay with PayKings/);
 assert.match(hub,/No payment|no payment|cannot be charged/i);
});
test("Gallery fallback and secure server side two to five post gating remain unchanged",()=>{
 assert.match(chooser,/add direct post links below/i);
 assert.match(chooser,/posts\.length<5/);
 assert.match(backend,/data\.postAllocations\.length>5/);
 assert.match(backend,/Multi-post checkout is available only for approved Litix Likes services/);
 assert.match(backend,/action!=="card_purchase"/);
 assert.match(backend,/idempotencyKey/);
});
