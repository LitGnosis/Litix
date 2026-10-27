import {randomUUID,timingSafeEqual} from "node:crypto";
import {chooseSql,dispatchPaidPosts} from "../../../../lib/choosePostsServer.mjs";
import {after} from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(req){
 const expected=String(process.env.LITIX_CHOOSE_POSTS_ADMIN_TOKEN||"");
 const supplied=String(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 if(expected.length<32||expected.length!==supplied.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))
  return Response.json({error:"Unauthorized"},{status:401});
 let data;try{data=await req.json()}catch{return Response.json({error:"Invalid request"},{status:400})}
 const orderId=String(data.orderId||""),itemId=String(data.itemId||"");
 if(!/^ltx2_[a-f0-9-]{36}$/.test(orderId)||!itemId||itemId.length>60)return Response.json({error:"Invalid IDs"},{status:400});
 const sql=chooseSql();
 // Only definite supplier rejections are safely retryable; timeouts stay manual.
 const result=await sql.query("update public.litix_choose_posts_items set state='QUEUED',updated_at=now() where id=$1 and order_id=$2 and state='RETRYABLE' and supplier_order_id is null and exists(select 1 from public.litix_choose_posts_orders where id=$2 and payment_state='paid') returning id",[itemId,orderId]);
 if(!result.length)return Response.json({error:"Item is not safely retryable; reconcile uncertain supplier outcomes first."},{status:409});
 after(()=>dispatchPaidPosts(orderId));
 return Response.json({queued:true,orderId,itemId},{headers:{"cache-control":"no-store"}});
}
