import {createHash} from "node:crypto";
import {validateSolutionInquiry} from "../../../../lib/litixSolutionInquiries.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(data,status=200)=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});

export async function POST(request){
 const origin=request.headers.get("origin");
 const internal=new URL(request.url).origin;
 if(!origin||(origin!==internal&&origin!=="https://www.litix.net"&&origin!=="https://litix.net"))
  return json({error:"This form accepts same-site submissions only."},403);
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
  return json({error:"Expected a JSON inquiry."},415);
 if(Number(request.headers.get("content-length")||0)>8192)return json({error:"The inquiry is too large."},413);
 let data;
 try{
  const raw=await request.text();
  if(raw.length>8192)return json({error:"The inquiry is too large."},413);
  data=JSON.parse(raw);
 }catch{return json({error:"Invalid inquiry."},400);}
 const result=validateSolutionInquiry(data);
 if(result.spam)return json({ok:true});
 if(!result.ok)return json({error:result.error},400);
 const key=process.env.RESEND_API_KEY||process.env.LITIX_RESEND_API_KEY;
 if(!key)return json({error:"Online requests are temporarily unavailable. Email litixsocial@gmail.com instead."},503);
 const p=result.data;
 const content=[
  "NEW LITIX SOLUTIONS LEAD — MANUAL QUOTE / PILOT ONLY",
  "Solution: "+p.solutionName+" ("+p.solution+")",
  "Name: "+p.name,
  "Email: "+p.email,
  "Organization: "+(p.organization||"Not provided"),
  "Budget range (USD): "+p.budget,
  "Project:",
  p.goals,
  "",
  "Contact consent: yes — only for this inquiry.",
  "No payment, subscription, seller account, allocation, booking or service order was created."
 ].join("\n");
 const id=createHash("sha256").update(JSON.stringify({name:p.name,email:p.email,solution:p.solution,budget:p.budget,goals:p.goals,date:new Date().toISOString().slice(0,10)})).digest("hex").slice(0,48);
 try{
  const res=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{"authorization":"Bearer "+key,"content-type":"application/json","Idempotency-Key":"litix-solutions-"+id},
   body:JSON.stringify({from:"Litix <orders@litix.net>",to:["litixsocial@gmail.com","litgnosisllc@gmail.com"],reply_to:p.email,subject:"Litix Solutions — "+p.solutionName+" inquiry",text:content}),
   signal:AbortSignal.timeout(8000),cache:"no-store"
  });
  if(!res.ok){console.error("solutions_inquiry_delivery_failed",{status:res.status});return json({error:"Unable to deliver this request. Email litixsocial@gmail.com instead."},503)}
  return json({ok:true,message:"Your request has been sent for manual review. No charge has been made."});
 }catch{return json({error:"Unable to deliver this request. Email litixsocial@gmail.com instead."},503)}
}
