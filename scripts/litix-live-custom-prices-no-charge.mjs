// Live, read-only customer pricing verification. No credentials, cards,
// contact addresses, supplier purchase requests or POST operations.
import assert from "node:assert/strict";

const targets=[
 {platform:"Instagram",expected:[["litix_4751","likes"],["litix_5461","followers"]]},
 {platform:"TikTok",expected:[["litix_5251","likes"],["litix_5101","followers"]]}
];
const base="https://www.litix.net";
const checked=[];
for(const target of targets){
 let response,body;
 for(let attempt=0;attempt<2;attempt++){
  response=await fetch(base+"/api/catalog/checkout-choices?platform="+encodeURIComponent(target.platform),{
   method:"GET",cache:"no-store",signal:AbortSignal.timeout(45000),
   headers:{accept:"application/json","user-agent":"Litix-ReadOnly-Price-Audit/1.0"}
  });
  body=await response.json().catch(()=>({}));
  if(response.ok&&Array.isArray(body.items))break;
  if(attempt===0)await new Promise(resolve=>setTimeout(resolve,1200));
 }
 assert.ok(response.ok,"public price catalog unavailable "+target.platform+" HTTP "+response.status);
 for(const [id,kind] of target.expected){
  const item=body.items.find(x=>x.id===id&&x.kind===kind&&x.platform===target.platform);
  assert.ok(item,"approved "+target.platform+" "+kind+" service not available in customer checkout catalog");
  assert.equal(item.purchasable,true,"public customer checkout gate not approved for "+id);
  const rate=Number(item.per1000),min=Number(item.min),max=Number(item.max);
  assert.ok(Number.isFinite(rate)&&rate>0,"missing retail quote "+id);
  assert.ok(rate>=(kind==="followers"?9:6),"retail price floor breached "+id);
  assert.ok(Number.isSafeInteger(min)&&min>=1&&Number.isSafeInteger(max)&&max>=min,"invalid quantity bounds "+id);
  assert.ok(Number.isSafeInteger(Number(item.startingAmountCents))&&Number(item.startingAmountCents)>=100,"minimum $1 not enforced "+id);
  checked.push({platform:target.platform,kind,id,retailPer1000USD:rate,minimum:min,maximum:max,source:body.liveAvailability?"live":"recently verified"});
 }
}
assert.equal(checked.length,4);
console.log("LITIX_LIVE_CUSTOM_PRICES_VERIFIED",JSON.stringify({count:checked.length,services:checked,requests:"GET_ONLY",charged:false}));
