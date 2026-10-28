import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const text=await readFile(new URL("../app/api/[action]/route.js",import.meta.url),"utf8");
const v1=await readFile(new URL("../app/api/checkout/v1/route.js",import.meta.url),"utf8");
const catalog=await readFile(new URL("../app/api/catalog/v1/route.js",import.meta.url),"utf8");
const marker="if(process.env.VERCEL_ENV===\"production\")return send({error:\"Legacy service purchases are disabled.";
const checkoutStart=text.indexOf("export async function POST(req){");
const originalLookupStart=text.indexOf("async function refreshSupplierOrder(");
const addCall=text.indexOf('smm("add"');
const paymentCall=text.indexOf("fetch(gatewayUrl");
const block=text.indexOf(marker);

test("production legacy checkout rejects ALL numeric SMMGLOB services before payment or supplier calls",async()=>{
  assert.ok(checkoutStart>0);
  assert.ok(block>checkoutStart&&block<paymentCall&&block<addCall,"no charge or supplier add may execute first");
  assert.match(v1,/if\(\/\^boostero_\[0-9\]/,"verified Boostero route stays namespaced");
  assert.match(v1,/return checkout\(new Request\(url, request\)\)/,"legacy numeric IDs route to deny path");

  // Execute the actual source checkout handler, isolated from all DB/provider imports.
  // Its production guard must short-circuit before any checkout work.
  const code='const send=(body,status=200)=>Response.json(body,{status});'+
    'const name=()=>"checkout";'+
    'const lookupOrderByEmail=()=>{throw Error("unreachable")};'+
    'const resendPaidOrderConfirmation=()=>{throw Error("unreachable")};'+
    text.slice(checkoutStart);
  const {POST}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
  const old=process.env.VERCEL_ENV;
  try{
    process.env.VERCEL_ENV="production";
    for(const id of ["33442","33559","1","999999","boostero_5461"]){
      const response=await POST(new Request("https://litix.net/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({serviceId:id,paymentToken:"fake-and-not-used"})}));
      assert.equal(response.status,409,id);
      const body=await response.json();
      assert.match(body.error,/Legacy service purchases are disabled/);
      assert.match(body.error,/No payment was attempted/);
      assert.equal(JSON.stringify(body).includes("security_key"),false);
    }
    assert.match(text,/const flags=conf\(\)/,"nonproduction checkout implementation remains in the source unchanged");
  }finally{old===undefined?delete process.env.VERCEL_ENV:process.env.VERCEL_ENV=old}
});
test("public legacy catalog never marks numeric supplier services purchasable in production",()=>{
  assert.match(text,/purchasable:process\.env\.VERCEL_ENV!==\"production\"&&/);
  assert.match(text,/\.map\(shape\)/);
  assert.match(catalog,/enabledBoosteroCards/);
  assert.match(catalog,/boosteroOnly:true/);
  assert.match(catalog,/const original=await catalog/);
});
test("historical SMMGLOB tracking, private lookup, and old orders remain untouched",()=>{
  assert.ok(originalLookupStart>=0&&originalLookupStart<checkoutStart);
  assert.match(text,/if\(name\(req\)===\"lookup-order\"\)return lookupOrderByEmail\(req\)/);
  assert.match(text,/if\(name\(req\)===\"resend-confirmation\"\)return resendPaidOrderConfirmation\(req\)/);
  assert.match(text,/if\(op===\"track\"\)/);
  assert.match(text,/await smm\(\"status\"/);
  assert.match(text,/public\.litix_boostero_fulfillment/);
  assert.match(text,/legacyPublicServiceAllowed\(service\)/,"old nonproduction flow preserved for diagnostics");
});
