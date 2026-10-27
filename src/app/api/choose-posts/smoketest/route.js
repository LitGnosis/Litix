import {timingSafeEqual,randomUUID} from "node:crypto";
import {POST as checkout} from "../checkout/route.js";
import {GET as track} from "../track/route.js";
import {getPreviewService} from "../../../../lib/choosePostsServer.mjs";
import {quoteSelectedPosts} from "../../../../lib/choosePosts.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=45;
export async function GET(req){
 const key=process.env.LITIX_CHOOSE_POSTS_SMOKE_SECRET||"",given=new URL(req.url).searchParams.get("token")||"";
 if(process.env.VERCEL_ENV!=="preview"||key.length<32||given.length!==key.length||
  !timingSafeEqual(Buffer.from(key),Buffer.from(given)))return Response.json({error:"Not found"},{status:404});
 try{
  const service=await getPreviewService("33676");
  const posts=["https://www.instagram.com/p/LitixDemoABC123/","https://www.instagram.com/reel/LitixDemoXYZ234/"];
  const q=Math.max(Number(service.min),1000);
  const quote=quoteSelectedPosts({service,quantityEach:q,postURLs:posts,checkWholesale:false});
  const url=new URL(req.url);url.pathname="/api/choose-posts/checkout";url.search="";
  const payment=await checkout(new Request(url,{method:"POST",
   headers:{"origin":url.origin,"content-type":"application/json"},
   body:JSON.stringify({username:"litix_preview_demo",serviceId:String(service.service),email:"litix-preview-nobilling@example.invalid",
    quantityEach:q,posts,expectedAmountCents:quote.totalCents,idempotencyKey:randomUUID(),simulate:true})}));
  const data=await payment.json();
  if(payment.status!==200||data.payment!=="simulated"||!data.orderId||!data.secret)
   return Response.json({passed:false,stage:"demo-checkout",http:payment.status,error:data.error||"Unexpected result"});
  url.pathname="/api/choose-posts/track";url.searchParams.set("order",data.orderId);url.searchParams.set("token",data.secret);
  const t=await track(new Request(url));const x=await t.json();
  return Response.json({passed:t.ok&&x.order?.payment==="simulated"&&x.order?.items?.length===2,
   payment:data.payment,orderId:data.orderId,chargedRealCard:false,submittedSupplier:false,
   trackedPosts:x.order?.items?.map(v=>({url:v.url,state:v.state,supplierId:v.supplierOrderId})),
   totalCents:quote.totalCents},{headers:{"cache-control":"no-store","referrer-policy":"no-referrer"}});
 }catch(error){return Response.json({passed:false,error:String(error.message||"Smoke test failed").slice(0,150)},
  {status:500,headers:{"cache-control":"no-store"}});}
}
