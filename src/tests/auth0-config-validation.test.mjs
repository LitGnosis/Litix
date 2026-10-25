import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../lib/customerAuth.js",import.meta.url),"utf8")
  .replace('import { Auth0Client } from "@auth0/nextjs-auth0/server";','class Auth0Client {}');
const envKeys=["LITIX_CUSTOMER_LOGIN_ENABLED","AUTH0_DOMAIN","AUTH0_CLIENT_ID","AUTH0_CLIENT_SECRET","AUTH0_SECRET","APP_BASE_URL","VERCEL_ENV"];
const original=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
for(const k of envKeys)delete process.env[k];
const config=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
test("Auth0 credentials never expose sessions when the launch flag is off",()=>{
 Object.assign(process.env,{AUTH0_DOMAIN:"qa.example.auth0.com",AUTH0_CLIENT_ID:"client-test",AUTH0_CLIENT_SECRET:"server-test-secret",AUTH0_SECRET:"f".repeat(64),APP_BASE_URL:"https://www.litix.net",VERCEL_ENV:"production"});
 assert.equal(config.customerAuthConfigured(),false);
});
test("Auth0 refuses missing client credentials, malformed session secrets and HTTP production URLs",()=>{
 process.env.LITIX_CUSTOMER_LOGIN_ENABLED="true";
 delete process.env.AUTH0_CLIENT_SECRET;
 assert.equal(config.customerAuthConfigured(),false);
 process.env.AUTH0_CLIENT_SECRET="qa-only";
 process.env.AUTH0_SECRET="short";
 assert.equal(config.customerAuthConfigured(),false);
 process.env.AUTH0_SECRET="a".repeat(64);
 process.env.APP_BASE_URL="http://www.litix.net";
 assert.equal(config.customerAuthConfigured(),false);
});
test("Preview supports Auth0 v4 dynamic host while production requires HTTPS base origin",()=>{
 process.env.VERCEL_ENV="preview";
 delete process.env.APP_BASE_URL;
 assert.equal(config.customerAuthConfigured(),true);
 process.env.VERCEL_ENV="production";
 assert.equal(config.customerAuthConfigured(),false);
 process.env.APP_BASE_URL="https://www.litix.net";
 assert.equal(config.customerAuthConfigured(),true);
});
test.after(()=>{for(const [k,v]of Object.entries(original)){if(v===undefined)delete process.env[k];else process.env[k]=v}});
