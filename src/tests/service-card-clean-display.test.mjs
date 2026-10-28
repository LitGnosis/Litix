import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {publicServiceCardName} from "../lib/serviceCardDisplay.mjs";

test("approved cards retain meaningful service type, never display hidden quality, rate caps, refill, IDs or supplier brands",()=>{
  const rows=[
    [{id:"boostero_5461",name:"📸 Instagram Followers ➡️ [ Premium Quality | 5K/Day | Non-Drop 🛡️ ] 30 Days Refill",category:"Instagram Followers"},"Instagram Followers"],
    [{id:"boostero_4751",name:"👍 Instagram Likes [ High Quality | 10K/Day | No Refill ]",category:"Instagram Likes"},"Instagram Likes"],
    [{id:"boostero_5101",name:"TikTok Followers [ Medium Quality | 100K/Day | No Non-Drop Claim ]",category:"TikTok Followers"},"TikTok Followers"],
    [{id:"boostero_5251",name:"👍 TikTok Likes ➡️ [ High Quality | 500/Day | No Refill ]",category:"TikTok Likes"},"TikTok Likes"],
    [{id:"33442",name:"TikTok 🎵 Saves [ Instant ⚡ ] [ 100K/Day ] [ Non-Drop 🛡️ ] No Refill",category:"TikTok Saves"},"TikTok Saves"],
    [{id:"33443",name:"TikTok 🎵 Share [ Instant ⚡ ] [ 100K/Day ] [ Non-Drop 🛡️ ] 30 Days Refill",category:"TikTok Share"},"TikTok Share"],
    [{id:"33678",name:"IG 📸 Shares | High Speed",category:"Instagram Shares"},"Instagram Shares"],
    [{id:"33679",name:"IG 📸 Impressions",category:"Instagram Impressions"},"Instagram Impressions"],
  ];
  for(const [product,expected] of rows){
    const copy=structuredClone(product);
    assert.equal(publicServiceCardName(product),expected,product.name);
    assert.deepEqual(product,copy,"Pure formatter must never modify supplier-backed service data");
  }
});
test("keeps meaningful geo and other product types; never invents price or approved status",()=>{
  assert.equal(publicServiceCardName({name:"Instagram 🇺🇸 American Followers [ High Quality | 5K/Day ]"}),"Instagram American Followers");
  assert.equal(publicServiceCardName({name:"YouTube Views | Fast Delivery"}),"YouTube Views");
  assert.equal(publicServiceCardName({name:"#boostero_5461",category:"Instagram Followers"}),"Instagram Followers");
  assert.equal(publicServiceCardName({name:" ",category:"LinkedIn Likes"}),"LinkedIn Likes");
  assert.equal(publicServiceCardName({}),"Social media service");
});
test("customer card markup uses only clean title, current actual price and current startingAmountCents",async()=>{
  const source=await readFile(new URL("../app/page.jsx",import.meta.url),"utf8");
  const style=await readFile(new URL("../app/metallic.css",import.meta.url),"utf8");
  const card=source.split('<div className="cards">')[1]?.split('}{!services.length')[0]||"";
  assert.ok(card,"Service card section must exist");
  assert.match(card,/publicServiceCardName\(s\)/);
  assert.match(card,/cardMoney\(Math\.ceil\(s\.per1000\*100\)\)/);
  assert.match(card,/Starting at "\+cardMoney\(s\.startingAmountCents\)/);
  assert.doesNotMatch(card,/className="service-badges"|Refill support|No refill|Non-Drop|No Non-Drop claim/);
  assert.match(style,/\.service-option \.service-card-name/);
  assert.match(style,/\.service-option \.service-card-price/);
  assert.match(source,/serviceId:selected\.id/,"Checkout still uses the actual original supplier-mapped service ID");
  assert.match(source,/setSelected\(s\);setQty\(s\.min\)/,"Original service & quantity handling must remain intact");
});
