import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {VERIFIED_CHECKOUT_SEED} from "../lib/litixCheckoutVerifiedSeed.mjs";
import {cleanCheckoutTitle,checkoutDisplay,defaultCheckoutQuantity,QUANTITY_PRESETS} from "../lib/litixCheckoutDisplay.mjs";
import {checkoutTargetPlaceholder,normalizeProfileDestination,validateLitixCheckoutTarget} from "../lib/litixOrderTarget.mjs";

const source=path=>readFile(new URL(path,import.meta.url),"utf8");

test("title suffix speed is moved to display subtitle without mutating catalog data",()=>{
 const indonesia=VERIFIED_CHECKOUT_SEED.items.find(s=>s.name==="Instagram Indonesia Followers 500/Day");
 assert.ok(indonesia,"verified Indonesia example must exist");
 const originalName=indonesia.name;
 const displayed=checkoutDisplay(indonesia);
 assert.equal(displayed.title,"Instagram Indonesia Followers");
 assert.match(displayed.subtitle,/Up to 500\/day/);
 assert.equal(indonesia.name,originalName);
 for(const [name,title,speed] of [
  ["Instagram Followers 1K/Day","Instagram Followers","Up to 1,000/day"],
  ["TikTok Followers 5K/Day","TikTok Followers","Up to 5,000/day"],
  ["Facebook Comments 250/Day Non Drop","Facebook Comments","Up to 250/day"],
  ["YouTube Views – 2K / Day","YouTube Views","Up to 2,000/day"]
 ]){
  assert.equal(cleanCheckoutTitle(name),title);
  const sample=checkoutDisplay({id:"litix_999999",name,per1000:9,min:100,max:5000,purchasable:true});
  assert.equal(sample.title,title);
  assert.ok(sample.subtitle.includes(speed),`${name} displays ${speed}`);
 }
});

test("profiles and post URL examples vary by platform and service type",()=>{
 const cases=[
  [{platform:"Instagram",kind:"followers"},"e.g. @username or https://instagram.com/username"],
  [{platform:"Instagram",kind:"likes"},"e.g. https://instagram.com/p/AbCd123/ or /reel/..."],
  [{platform:"Instagram",kind:"views"},"e.g. https://instagram.com/p/AbCd123/ or /reel/..."],
  [{platform:"TikTok",kind:"followers"},"e.g. @username or https://tiktok.com/@username"],
  [{platform:"TikTok",kind:"likes"},"e.g. https://tiktok.com/@creator/video/1234567890123456789"],
  [{platform:"YouTube",kind:"subscribers"},"e.g. @channel or https://youtube.com/@channel"],
  [{platform:"YouTube",kind:"views"},"e.g. https://youtube.com/watch?v=abcdefghijk"],
  [{platform:"Facebook",kind:"followers"},"e.g. @page or https://facebook.com/page"],
  [{platform:"Facebook",kind:"likes"},"e.g. https://facebook.com/page/posts/12345"],
  [{platform:"Twitter (X)",kind:"followers"},"e.g. @username or https://x.com/username"],
  [{platform:"Twitter (X)",kind:"retweets"},"e.g. https://x.com/creator/status/123456789012"]
 ];
 for(const [service,expected] of cases)
  assert.equal(checkoutTargetPlaceholder(service),expected,service.platform+" "+service.kind);
 assert.equal(normalizeProfileDestination("@username","instagram").ok,true);
 assert.equal(validateLitixCheckoutTarget("https://x.com/creator/status/123456789012",{platform:"Twitter (X)",kind:"retweets"}).ok,true);
});

test("checkout trust text remains accurate and avoids unsupported promises",async()=>{
 const page=await source("../app/page.jsx");
 const premium=await source("../components/PremiumInlineCheckout.jsx");
 const lib=await source("../lib/litixCheckoutDisplay.mjs");
 assert.match(page,/checkoutTargetPlaceholder\(selected\)/);
 assert.match(page,/link\.trim\(\)&&!targetFeedback\.ok\?targetFeedback\.message/);
 assert.doesNotMatch(page,/checkoutProfilePlaceholder/);
 for(const value of ["Live service verification","Private order tracking","PayKings-hosted card fields"])
  assert.ok(premium.includes(value));
 assert.doesNotMatch(premium,/30.Day Refill Guarantee|Instant Automated Start|256.Bit PayKings Encryption/i);
 assert.match(premium,/premium-pay-button/);
 assert.match(premium,/id="ccnumber"/);
 assert.match(page,/verifyQuoteBeforePayment\(\)/);
 assert.match(page,/getCollectJS\(\)\.startPaymentRequest\(\)/);
 assert.match(lib,/compareCheckoutCards/);
 assert.deepEqual(QUANTITY_PRESETS,[250,500,1000,2500,5000]);
 const first=VERIFIED_CHECKOUT_SEED.items.find(s=>s.id==="litix_2132");
 assert.equal(defaultCheckoutQuantity(first),1000);
});
