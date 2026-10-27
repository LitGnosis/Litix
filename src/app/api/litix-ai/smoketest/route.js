import {timingSafeEqual} from "node:crypto";
import {POST as answerQuestion} from "../route.js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=45;

export async function GET(request) {
  const expected=process.env.LITIX_AI_SMOKE_SECRET||"";
  const supplied=new URL(request.url).searchParams.get("token")||"";
  if(process.env.VERCEL_ENV!=="preview"||!expected||supplied.length!==expected.length||
    !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) {
    return Response.json({error:"Not found"},{status:404,headers:{"cache-control":"no-store"}});
  }
  const base=new URL(request.url);
  base.pathname="/api/litix-ai";
  base.search="";
  const questions=[
    "How much are Instagram followers per 1,000 and do you guarantee permanent results?",
    "What do the Instagram Launch and Momentum growth bundles cost, and are they automatic?",
    "What is Litix Guardian's current status? Can you refund my payment?"
  ];
  const outputs=await Promise.all(questions.map(async(message)=>{
    const req=new Request(base.toString(),{
      method:"POST",
      headers:{"origin":base.origin,"content-type":"application/json","x-forwarded-for":"198.51.100.99"},
      body:JSON.stringify({message,history:[]})
    });
    const response=await answerQuestion(req);
    const body=await response.json().catch(()=>({error:"Invalid response"}));
    return {status:response.status,ok:response.status===200&&typeof body.reply==="string"&&body.reply.length>20,
      reply:typeof body.reply==="string"?body.reply.slice(0,700):null,
      error:typeof body.error==="string"?body.error.slice(0,160):null};
  }));
  return Response.json({passed:outputs.every(x=>x.ok),cases:outputs},
    {headers:{"cache-control":"no-store","x-robots-tag":"noindex","referrer-policy":"no-referrer"}});
}
