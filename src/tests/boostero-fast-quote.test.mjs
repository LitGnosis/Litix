import test from "node:test";
import assert from "node:assert/strict";
import {createBoosteroBatchQuote} from "../lib/boosteroMultiPostFulfillment.mjs";

const service={service:"4751",name:"Instagram Likes",category:"Instagram",type:"Default",min:10,max:1000000,rate:"6.99"};

test("one service listing is shared across five independent quotes",async()=>{
 let reads=0;
 const quote=createBoosteroBatchQuote({loadServices:async()=>{reads++;return [service];},fallback:async()=>{throw Error("unexpected fallback");}});
 const result=await Promise.all([1000,1100,1200,1300,1400].map(q=>quote("4751",q,{})));
 assert.equal(reads,1);
 assert.deepEqual(result.map(x=>x.quote.quantity),[1000,1100,1200,1300,1400]);
 assert.ok(result.every(x=>x.quote.serviceId==="4751"));
 await assert.rejects(quote("bad-id",1000,{}),/boostero_service_id_invalid/);
});
test("supplier catalog read failures fall back to prior independent verification",async()=>{
 let reads=0,fallbacks=0;
 const quote=createBoosteroBatchQuote({loadServices:async()=>{reads++;throw Error("catalog_unavailable");},fallback:async(id,qty)=>{fallbacks++;return {quote:{serviceId:id,quantity:qty},service:{service:id}};}});
 const result=await Promise.all([100,200].map(q=>quote("4751",q,{})));
 assert.equal(reads,1);
 assert.equal(fallbacks,2);
 assert.deepEqual(result.map(x=>x.quote.quantity),[100,200]);
});
