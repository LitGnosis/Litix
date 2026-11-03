import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const page=read("app/custom-likes/page.jsx");
const hub=read("components/LitixCustomHub.jsx");
const home=read("app/page.jsx");
const orders=read("app/custom-orders/page.jsx");
const directory=read("components/LitixDirectory.jsx");
const chooser=read("components/SocialMultiPostChooser.jsx");
const backend=read("lib/boosteroOrderHandler.mjs");

test("Unified Custom Likes and Followers navigation and four approved platform links are discoverable",()=>{
 assert.match(page,/Custom Likes & Followers/);
 assert.match(page,/LitixCustomHub/);
 assert.match(home,/href="\/custom-likes"/);
 assert.match(orders,/href="\/custom-likes"/);
 assert.match(directory,/href="\/custom-likes"/);
 for(const id of ["4751","5251","5461","5101"])assert.ok(hub.includes("litix_"+id));
 assert.match(hub,/mode=multi/);
 assert.match(hub,/kind==="likes"/);
 assert.match(read("app/custom-followers/page.jsx"),/redirect\("\/custom-likes\?kind=followers"\)/);
});

test("Deep links open multi-post chooser only for approved Likes; Followers use secure single-order flow",()=>{
 assert.match(home,/params\.get\("mode"\)==="multi"/);
 assert.match(home,/\["litix_4751","litix_5251"\]\.includes\(requested\)/);
 assert.match(home,/setMultiPostEnabled\(customLikesIntent\)/);
 assert.match(home,/newTikTokPost\(\{quantity:Number\(selected\?\.min\)\|\|1\}\)/);
 assert.match(home,/SocialMultiPostChooser/);
 assert.match(hub,/kind==="likes"\?"&mode=multi":""/);
});

test("Service cards preserve one secure PayKings purchase and no-charge selection",()=>{
 assert.match(directory,/\?service=/);
 assert.match(directory,/&mode=multi/);
 assert.match(directory,/Review & pay with PayKings/);
 assert.match(hub,/No order is placed by selecting a service/);
});

test("Gallery fallback and secure server-side two-to-five Likes gating remain unchanged",()=>{
 assert.match(chooser,/add direct post links below/i);
 assert.match(chooser,/posts\.length<5/);
 assert.match(backend,/data\.postAllocations\.length>5/);
 assert.match(backend,/Multi-post checkout is available only for approved Litix Likes services/);
 assert.match(backend,/action!=="card_purchase"/);
 assert.match(backend,/idempotencyKey/);
});
