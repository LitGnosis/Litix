import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const front=read("app/page.jsx"),back=read("app/api/[action]/route.js");
const frontCode=front.slice(front.indexOf("const socialPlatformForService=service=>{"),front.indexOf("export default function Home(){"));
const backCode=back.slice(back.indexOf("const followerPlatformForService=service=>{"),back.indexOf("const followerRank=x=>"));
const frontend=vm.runInNewContext(frontCode+";({socialPlatformForService,normalizeSocialProfileInput})",{URL});
const backend=vm.runInNewContext(backCode+";({followerPlatformForService,canonicalFollowerDestination})",{URL});

test("followers are recognized from service name OR category for Instagram/IG and TikTok/Tik Tok",()=>{
 const examples=[
  [{name:"Instagram Followers",category:"Instagram"}, "instagram"],
  [{name:"APP Data | High Speed | No Refill",category:"Instagram Followers"}, "instagram"],
  [{name:"IG followers | high speed",category:"Social Media"}, "instagram"],
  [{name:"Tik Tok Followers Premium",category:"Tik Tok"}, "tiktok"],
  [{name:"Fast followers",category:"TikTok Followers"}, "tiktok"],
 ];
 for(const [service,expected] of examples){
  assert.equal(frontend.socialPlatformForService(service),expected);
  assert.equal(backend.followerPlatformForService(service),expected);
 }
 for(const service of [{name:"Instagram Likes",category:"Instagram Likes"},{name:"TikTok Views",category:"TikTok Views"},{name:"Instagram Post Likes",category:"Instagram"}]){
  assert.equal(frontend.socialPlatformForService(service),"");
  assert.equal(backend.followerPlatformForService(service),"");
 }
});
test("Instagram and TikTok username, @handle and direct profile links produce exact canonical destination",()=>{
 const examples=[
  ["litixsocial","instagram","https://www.instagram.com/litixsocial/"],
  ["@litixsocial","instagram","https://www.instagram.com/litixsocial/"],
  ["https://instagram.com/litixsocial","instagram","https://www.instagram.com/litixsocial/"],
  ["instagram.com/litixsocial/?igsh=abc","instagram","https://www.instagram.com/litixsocial/"],
  ["@litixsocial","tiktok","https://www.tiktok.com/@litixsocial"],
  ["https://www.tiktok.com/@litixsocial?lang=en","tiktok","https://www.tiktok.com/@litixsocial"],
 ];
 for(const [value,platform,expected] of examples){
  assert.equal(frontend.normalizeSocialProfileInput(value,platform).url,expected);
  assert.equal(backend.canonicalFollowerDestination(value,platform),expected);
 }
});
test("invalid post URLs, unsafe URLs and cross-platform handles are not accepted for Followers",()=>{
 const examples=[
  ["https://instagram.com/p/short123","instagram"],
  ["https://instagram.com/reel/short123","instagram"],
  ["https://tiktok.com/@litixsocial/video/123","tiktok"],
  ["https://instagram.evil.com/user","instagram"],
  ["https://tiktok.com/@litixsocial","instagram"],
  ["https://instagram.com/user:pass@evil.com/profile","instagram"],
  ["http://instagram.com/litixsocial","instagram"],
  ["javascript:alert(1)","tiktok"],
 ];
 for(const [value,platform] of examples){
  assert.equal(backend.canonicalFollowerDestination(value,platform),null);
  assert.equal(frontend.normalizeSocialProfileInput(value,platform).ok,false);
 }
});
test("frontend clearly requests username or profile link for follower purchases",()=>{
 assert.match(front,/Instagram username or profile link/);
 assert.match(front,/TikTok username or profile link/);
 assert.match(front,/socialPlatformForService\(selected\)/);
 assert.match(front,/link:normalizedOrderLink/);
});
test("backend validates follower destination, stores and dispatches the same normalized profile URL",()=>{
 assert.match(back,/const followerPlatform=followerPlatformForService\(service\)/);
 assert.match(back,/destination=canonicalFollowerDestination\(link,followerPlatform\)/);
 assert.match(back,/destination,qty,cents/);
 assert.match(back,/smm\("add",\{service:id,link:destination,quantity:String\(qty\)\}\)/);
 assert.match(back,/const cents=Math\.max\(100,Math\.ceil\(retailPer1000\(service\)/);
 assert.match(back,/payment_token:token/);
});
