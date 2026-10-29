// Read-only source policy gate. No secrets or network requests.
import {readFile, readdir} from "node:fs/promises";
import {join} from "node:path";
const root=process.cwd(),issues=[];
const read=async p=>readFile(join(root,p),"utf8");
async function scan(directory){
 for(const ent of await readdir(join(root,directory),{withFileTypes:true})){
  const p=directory+"/"+ent.name;
  if(ent.isDirectory())await scan(p);
  else if(/\.(?:m?js|jsx|ts|tsx)$/.test(ent.name)){
   const code=await read(p);
   if(/process\.env\.(?:SMMGLOB|SMMFOLLOWOM)_API_(?:KEY|URL)\b/.test(code)||
      /https:\/\/(?:my\.|www\.)?(?:smmglob|smmfollowom)\.com\b/i.test(code))
      issues.push(p+": retired supplier API configuration or URL");
  }
 }
}
await scan("app/api");await scan("lib");
const legacy=await read("app/api/[action]/route.js");
if(!/return send\(\{error:"Retired supplier checkout is disabled/.test(legacy))issues.push("legacy checkout must fail before card processing");
const oldCron=await read("app/api/v2/cron/sync-catalog/route.js");
if(!/status:410/.test(oldCron))issues.push("retired supplier sync must return 410");
const active=await read("app/api/checkout/v1/route.js");
if(!/\^boostero_/.test(active))issues.push("new checkout must require Boostero IDs");
const catalogs=await read("app/api/litix-multi-catalog/route.js");
if(!/catalog\/v1\/route/.test(catalogs))issues.push("catalog alias must use Boostero");
const schedule=JSON.parse(await read("vercel.json"));
if(schedule.crons?.some(c=>c.path==="/api/v2/cron/sync-catalog"))issues.push("retired supplier cron still scheduled");
if(issues.length){for(const x of issues)console.error("BLOCK: "+x);process.exitCode=1}
else console.log("PASS: Boostero-only new-order routing and retired supplier scheduler policy");
