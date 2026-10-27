import {guardianDb} from "../../../../lib/guardianRuntime.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=15;
// Safe PUBLIC endpoint for an external checker: no auth, no credentials, no
// customer data or order IDs, and NO supplier requests triggered by visitors.
export async function GET(){
 try{
  const db=guardianDb();
  const checks=await db.query("select component,status,checked_at from public.litix_guardian_components where component in ('website','catalog','tiktok','instagram','database') order by component");
  const required=["website","catalog","tiktok","instagram","database"];
  const available=new Map(checks.map(x=>[x.component,x]));
  const fresh=required.every(x=>{
   const c=available.get(x);
   return c&&c.status==="healthy"&&Number.isFinite(new Date(c.checked_at).getTime())&&Date.now()-new Date(c.checked_at).getTime()<20*60*1000;
  });
  return Response.json({service:"litix-guardian",functional:!!fresh,checkedComponents:checks.length},
   {status:fresh?200:503,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
 }catch{
  return Response.json({service:"litix-guardian",functional:false,error:"Probe storage unavailable"},
   {status:503,headers:{"cache-control":"no-store"}});
 }
}
