import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {publicServiceCardName,litixCustomerServiceName} from "../lib/serviceCardDisplay.mjs";

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

test("all Litix directory product labels remove supplier promotions and manual-refill terms only",async()=>{
  const cases=[
    ["🇺🇸 Instagram USA Followers ➡️ [ Super Real Accounts | 5K/Day | 30 Days Manual Refill ] - Boostero’s Top Pick 🔥","🇺🇸 Instagram USA Followers ➡️ [ Super Active Accounts | 5K/Day ]"],
    ["🇺🇸 Instagram USA Followers ➡️ [ Real Accounts | 1K/Day | 365 Days Manual Refill ]","🇺🇸 Instagram USA Followers ➡️ [ Active Accounts | 1K/Day ]"],
    ["👱 Instagram Latin Followers ➡️ [ High Quality | 5K/Day | 30 Days Manual Refill ]","👱 Instagram Latin Followers ➡️ [ High Quality | 5K/Day ]"],
    ["Instagram Followers [ Premium Quality | 20K/Day | 30 Days Refill Button ]","Instagram Followers [ Premium Quality | 20K/Day | 30 Days Refill Button ]"],
    ["Boostero Instagram Likes","Instagram Likes"]
  ];
  for(const [raw,expected] of cases)assert.equal(litixCustomerServiceName(raw),expected);
  assert.doesNotMatch(publicServiceCardName({name:cases[0][0]}),/boostero|top pick|manual refill/i);
  const directory=await readFile(new URL("../components/LitixDirectory.jsx",import.meta.url),"utf8");
  assert.match(directory,/<h3>\{litixCustomerServiceName\(s\.name\)\}<\/h3>/);
  assert.match(directory,/litixCustomerServiceName\(s\.category\)/);
  assert.doesNotMatch(directory,/current Boostero rate/);
});

test("customer-facing Real labels read Active without altering service records",()=>{
  const examples=[
    ["Instagram Arab Male Followers [ Super Real Accounts | 1K/Day ]","Instagram Arab Male Followers [ Super Active Accounts | 1K/Day ]"],
    ["Instagram Arab Female Followers [ Super Real Accounts | 1K/Day ]","Instagram Arab Female Followers [ Super Active Accounts | 1K/Day ]"],
    ["Instagram Real Followers","Instagram Active Followers"],
    ["TikTok REAL Likes","TikTok ACTIVE Likes"],
    ["YouTube real views","YouTube active views"]
  ];
  for(const [raw,expected] of examples){
    const service={name:raw,id:"boostero_4491",per1000:12.86,min:78,max:100000};
    assert.equal(litixCustomerServiceName(service.name),expected);
    assert.deepEqual(service,{name:raw,id:"boostero_4491",per1000:12.86,min:78,max:100000});
    assert.doesNotMatch(publicServiceCardName(service),/\\breal\\b/i);
  }
  assert.equal(publicServiceCardName({name:"",category:"Real Instagram Followers"}),"Active Instagram Followers");
});
