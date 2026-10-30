import test from "node:test";
import assert from "node:assert/strict";
import {inspectTikTokVideoLink,resolveTikTokVideoLink} from "../lib/tiktokVideoLinks.mjs";
import {readFileSync} from "node:fs";

test("TikTok direct video URL is canonicalized without remote requests",async()=>{
 const expected="https://www.tiktok.com/@public_creator/video/7463829101526372818";
 for(const input of [expected,expected+"?is_from_webapp=1",expected+"/",expected.replace("www.","")]){
   assert.equal(await resolveTikTokVideoLink(input,{fetcher:()=>{throw Error("unexpected fetch")}}),expected);
 }
});

test("TikTok supported share links resolve through an allowlisted redirect",async()=>{
 const urls=["https://www.tiktok.com/t/ZTfcN9SEq/","https://vm.tiktok.com/ZMabcdef/","https://vt.tiktok.com/ZSabcdef/"];
 const expected="https://www.tiktok.com/@public_creator/video/7463829101526372818";
 for(const url of urls){
   assert.equal(inspectTikTokVideoLink(url)?.kind,"short");
   let calls=0;
   const result=await resolveTikTokVideoLink(url,{fetcher:async(x,opts)=>{
     calls++;
     assert.equal(x,url);
     assert.equal(opts.redirect,"manual");
     return new Response(null,{status:302,headers:{location:expected+"?from=share"}});
   }});
   assert.equal(result,expected);
   assert.equal(calls,1);
 }
});

test("TikTok share links use GET fallback if HEAD produces no redirect",async()=>{
 const short="https://www.tiktok.com/t/ZTfcN9SEq/";
 const out=await resolveTikTokVideoLink(short,{fetcher:async(_url,options)=>
   options.method==="HEAD"?new Response(null,{status:200}):
     new Response(null,{status:302,headers:{location:"https://www.tiktok.com/@creator/video/7463829101526372818"}})
 });
 assert.equal(out,"https://www.tiktok.com/@creator/video/7463829101526372818");
});

test("Reject arbitrary hosts, dangerous redirects, profiles and unrelated social links",async()=>{
 for(const input of [
  "http://www.tiktok.com/t/ZTfcN9SEq/","https://tiktok.com.evil.test/t/ZTfcN9SEq/",
  "https://www.tiktok.com/@creator","https://www.tiktok.com/@creator/photo/7463829101526372818",
  "https://user:pass@www.tiktok.com/t/ZTfcN9SEq/","https://127.0.0.1/t/ZTfcN9SEq/",
  "https://www.instagram.com/p/ABC12345/","javascript:alert(1)"
 ]){
   assert.equal(inspectTikTokVideoLink(input),null);
   await assert.rejects(resolveTikTokVideoLink(input,{fetcher:()=>{throw Error("unexpected fetch")}}));
 }
 let count=0;
 await assert.rejects(resolveTikTokVideoLink("https://vm.tiktok.com/ZMabcdef/",{
   fetcher:async()=>{count++;return new Response(null,{status:302,headers:{location:"https://private.example.com/"}})}
 }),/does not lead/);
 assert.equal(count,1);
});

test("Checkout resolves TikTok Likes before collecting any payment; existing Instagram and follower logic unchanged",()=>{
 const server=readFileSync(new URL("../lib/boosteroOrderHandler.mjs",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/page.jsx",import.meta.url),"utf8");
 assert.match(server,/resolveTikTokVideoLink/);
 assert.ok(server.indexOf("resolveTikTokVideoLink")<server.indexOf("idempotencyKey required"));
 assert.match(page,/tiktokLinkVerification/);
 assert.match(page,/Verify TikTok video link/);
 assert.match(page,/TikTok video verified/);
 assert.match(page,/link:normalizedOrderLink/);
 assert.match(page,/expectedAmountCents:price/);
});
