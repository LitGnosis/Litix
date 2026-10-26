import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {supplierServiceAllows} from "../lib/liveAutoLikes.mjs";

const instagram=[{service:33588,name:"Instagram Likes",min:100,max:10000}];
const tiktok=[{service:4433,name:"TikTok Likes",min:50,max:20000}];

test("current SMMGLOB service ID and quantity must both be valid before a chargeable order",()=>{
 assert.equal(supplierServiceAllows({platform:"instagram",service_id:"33588",likes:500},instagram),true);
 assert.equal(supplierServiceAllows({platform:"instagram",service_id:"33588",likes:99},instagram),false);
 assert.equal(supplierServiceAllows({platform:"instagram",service_id:"33588",likes:10001},instagram),false);
 assert.equal(supplierServiceAllows({platform:"instagram",service_id:"33589",likes:500},instagram),false);
 assert.equal(supplierServiceAllows({platform:"tiktok",service_id:"4433",likes:100},tiktok),true);
 assert.equal(supplierServiceAllows({platform:"tiktok",service_id:"4433",likes:100},instagram),false);
 assert.equal(supplierServiceAllows({platform:"tiktok",service_id:"4433",likes:-10},tiktok),false);
 assert.equal(supplierServiceAllows({platform:"tiktok",service_id:"4433",likes:1.5},tiktok),false);
 assert.equal(supplierServiceAllows({platform:"youtube",service_id:"33588",likes:500},instagram),false);
 assert.equal(supplierServiceAllows({platform:"instagram",service_id:"33588",likes:500},[]),false);
});

test("live worker is SMMGLOB-only, fail closed, and catalog checks precede add requests",()=>{
 const source=readFileSync(new URL("../lib/liveAutoLikes.mjs",import.meta.url),"utf8");
 assert.match(source,/fetchLikesServices\(row.platform\)/);
 assert.ok(source.indexOf("fetchLikesServices(row.platform)")<source.indexOf('action:"add"'));
 assert.match(source,/SUPPLIER_CATALOG_UNAVAILABLE/);
 assert.match(source,/SERVICE_OR_QUANTITY_NOT_AVAILABLE/);
 assert.match(source,/VERCEL_ENV!=="production"/);
 assert.match(source,/LITIX_AUTOLIKES_DISPATCH_ENABLED/);
 assert.doesNotMatch(source,/SMMFOLLOWOM|smmfollowom/i);
});
