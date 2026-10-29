/**
 * ONE-TIME, preview-branch-only supplier inventory import.
 * Runs after a successful preview build, never on production.
 * Uses Vercel's EXISTING protected preview Boostero and Neon credentials.
 * No credentials printed, no card payments, no supplier orders, no customer edits.
 */
import {neon} from "@neondatabase/serverless";
import {boosteroReadOnly} from "../lib/boosteroReadOnly.mjs";
import {importBoosteroInventory} from "../lib/boosteroInventorySync.mjs";
const branch="feature/boostero-neon-inventory-completion-20261028";
if(process.env.VERCEL_ENV!=="preview"||process.env.VERCEL_GIT_COMMIT_REF!==branch){
 console.log("LITIX_STAGING_IMPORT_SKIPPED_NOT_TARGET_PREVIEW_BRANCH");
 process.exit(0);
}
const uri=String(process.env.LITIX_INVENTORY_STAGING_DATABASE_URL||"");
const expected=String(process.env.LITIX_INVENTORY_STAGING_EXPECTED_HOST||"");
const stagingHosts=new Set([
 "ep-rapid-morning-b8vcnyw9-pooler.c-14.us-east-1.aws.neon.tech",
 "ep-rapid-morning-b8vcnyw9.c-14.us-east-1.aws.neon.tech"
]);
let parsed;
try{parsed=new URL(uri)}catch{throw Error("STAGING_DATABASE_URL_UNAVAILABLE")}
if(parsed.protocol!=="postgresql:"||parsed.hostname!==expected||
 !stagingHosts.has(parsed.hostname)||parsed.pathname!=="/neondb"||!parsed.username||!parsed.password){
 throw Error("STAGING_DATABASE_HOST_NOT_APPROVED");
}
try{
 const raw=await boosteroReadOnly("services");
 const sql=neon(uri);
 const result=await importBoosteroInventory(sql,raw,{force:true});
 const rows=await sql.query("select count(*)::integer as n,count(*) filter (where active)::integer as active from public.litix_boostero_inventory");
 if(Number(rows[0]?.active)!==result.imported||Number(rows[0]?.n)<result.imported)
  throw Error("STAGING_IMPORTED_COUNT_MISMATCH");
 console.log("LITIX_STAGING_IMPORT_SUCCEEDED",JSON.stringify({
  retrieved:result.retrieved,valid:result.valid,invalid:result.invalid,
  imported:result.imported,dbActive:Number(rows[0].active),dbTotal:Number(rows[0].n),
  publicNewServicesEnabled:0,atomicCommitVerified:result.atomicCommitVerified
 }));
}catch(error){
 const message=String(error?.message||"");
 const code=/^inventory_[a-z0-9_]+$/.test(message)?message:"STAGING_IMPORT_FAILED";
 console.error("LITIX_STAGING_IMPORT_ERROR",code);
 process.exitCode=1;
}
