import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {litixPlatform,litixKind} from "../lib/litixServiceClassify.mjs";
import {profilePlatformForService,normalizeProfileDestination} from "../lib/litixOrderTarget.mjs";
import {boosteroProfile,boosteroDestination} from "../lib/boosteroFulfillment.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const home=read("app/page.jsx"),checkout=read("app/api/checkout/v1/route.js");
const approved=[
 ["Instagram followers","Social", "instagram"],
 ["Fast followers","TikTok followers","tiktok"],
 ["IG Followers | Active","Social media","instagram"],
 ["Tik Tok Followers","Other","tiktok"]
];
test("litix frontend and current Boostero catalog recognize follower services",()=>{
 for(const [name,category,platform] of approved){
  const s={name,category,platform:litixPlatform(name,category),kind:litixKind(name,category)};
  assert.equal(profilePlatformForService(s),platform);
 }
 assert.equal(profilePlatformForService({platform:"Instagram",kind:"likes"}),"");
 assert.equal(profilePlatformForService({platform:"TikTok",kind:"views"}),"");
});
test("username and public profile links normalize for approved Followers checkout",()=>{
 const examples=[
  ["litixsocial","instagram","https://www.instagram.com/litixsocial/"],
  ["@litixsocial","instagram","https://www.instagram.com/litixsocial/"],
  ["https://instagram.com/litixsocial","instagram","https://www.instagram.com/litixsocial/"],
  ["instagram.com/litixsocial/?igsh=abc","instagram","https://www.instagram.com/litixsocial/"],
  ["@litixsocial","tiktok","https://www.tiktok.com/@litixsocial"],
  ["https://www.tiktok.com/@litixsocial?lang=en","tiktok","https://www.tiktok.com/@litixsocial"]
 ];
 for(const [input,platform,canonical] of examples){
  const normalized=normalizeProfileDestination(input,platform);
  assert.equal(normalized.ok,true,input);
  assert.equal(normalized.url,canonical,input);
  assert.equal(boosteroDestination(normalized.url,platform,"followers"),
   platform==="tiktok"?canonical+"/":canonical);
 }
});
test("follower checkout rejects post URLs, unsafe hosts and cross-platform links",()=>{
 const cases=[
  ["https://instagram.com/p/short123","instagram"],
  ["https://instagram.com/reel/short123","instagram"],
  ["https://tiktok.com/@litixsocial/video/12345678901234","tiktok"],
  ["https://instagram.evil.com/user","instagram"],
  ["https://tiktok.com/@litixsocial","instagram"],
  ["https://instagram.com/user:pass@evil.com/profile","instagram"],
  ["http://instagram.com/litixsocial","instagram"],
  ["javascript:alert(1)","tiktok"]
 ];
 for(const [input,platform] of cases)assert.equal(normalizeProfileDestination(input,platform).ok,false,input);
 assert.equal(boosteroProfile("https://instagram.evil.com/user","instagram"),null);
});
test("homepage switches between a public profile for Followers and a post URL for Likes",()=>{
 assert.match(home,/profilePlatformForService\(selected\)/);
 assert.match(home,/checkoutProfileLabel\(socialPlatform\)/);
 assert.match(home,/normalizeProfileDestination\(link/);
 assert.match(home,/selected\?\.kind==="likes"/);
 assert.match(home,/tiktokLikes\?.*"One video"/);
 assert.match(home,/link:normalizedOrderLink/);
});
test("current checkout routes exclusively to verified Boostero orders without exposing keys",()=>{
 assert.match(checkout,/handleBoosteroOrder/);
 assert.match(checkout,/Only available Litix services can be purchased/);
 assert.match(checkout,/action:"card_purchase"/);
 assert.doesNotMatch(checkout,/smmglob|SMMFOLLOWOM|SMMGLOB/i);
 const supplier=read("lib/boosteroFulfillment.mjs");
 assert.match(supplier,/export function boosteroDestination/);
 assert.match(supplier,/export async function verifyBoosteroQuote/);
});
