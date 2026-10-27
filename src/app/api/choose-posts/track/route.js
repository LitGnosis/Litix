import {chooseSql,sha,supplier} from "../../../../lib/choosePostsServer.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=45;
const output=(v,status=200)=>Response.json(v,{status,headers:{"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
const validId=id=>/^ltx2_[a-f0-9-]{36}$/.test(String(id||""));
const summarize=x=>({url:x.post_url,quantity:x.quantity,amountCents:x.amount_cents,
 state:x.state,supplierOrderId:x.supplier_order_id||null,
 supplierStatus:x.supplier_status?.status||null,
 checkedAt:x.supplier_status?.checkedAt||null,
 needsReview:["UNKNOWN_OUTCOME","MANUAL_REVIEW","RETRYABLE"].includes(x.state)});
async function lookup(id,where,value){
 if(!validId(id))return output({error:"Invalid order number."},400);
 const sql=chooseSql();
 let records;
 try{
  const statement="select id,username,service_name,quantity_each,total_cents,payment_state,fulfillment_state,created_at from public.litix_choose_posts_orders where id=$1 and "+where+"=$2 limit 1";
  records=await sql.query(statement,[id,value]);
 }catch{return output({error:"Tracking temporarily unavailable."},503);}
 if(!records.length)return output({error:"Order not found."},404);
 const x=records[0];
 let items;
 try{items=await sql.query("select id,post_url,quantity,amount_cents,state,supplier_order_id,supplier_status from public.litix_choose_posts_items where order_id=$1 order by ordinal",[id]);}
 catch{return output({error:"Per-post status temporarily unavailable."},503);}
 if(x.payment_state==="paid"){
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{
   while(cursor<items.length){
    const item=items[cursor++];
    if(!item.supplier_order_id||!["SUBMITTED","COMPLETED"].includes(item.state))continue;
    const last=Date.parse(String(item.supplier_status?.checkedAt||""));
    if(Number.isFinite(last)&&Date.now()-last<120000)continue;
    try{
     const info=await supplier("status",{order:String(item.supplier_order_id)});
     const state=/^completed|complete|finished$/i.test(String(info.status||""))?"COMPLETED":"SUBMITTED";
     const next={...info,checkedAt:new Date().toISOString()};
     await sql.query("update public.litix_choose_posts_items set supplier_status=$2::jsonb,state=$3,updated_at=now() where id=$1 and supplier_order_id=$4",
      [item.id,JSON.stringify(next),state,String(item.supplier_order_id)]);
     item.supplier_status=next;item.state=state;
    }catch{/* Retain last verified supplier state and make no unverified claims. */}
   }
  }));
 }
 return output({order:{id:x.id,username:x.username,service:x.service_name,quantityEach:x.quantity_each,
  totalCents:x.total_cents,payment:x.payment_state,fulfillment:x.fulfillment_state,createdAt:x.created_at,
  items:items.map(summarize)}});
}
export async function GET(req){
 const p=new URL(req.url).searchParams;
 const token=String(p.get("token")||"");
 if(token.length<25||token.length>150)return output({error:"Private tracking token required."},400);
 return lookup(p.get("order"),"tracking_token_hash",sha(token));
}
export async function POST(req){
 let data;try{data=await req.json();}catch{return output({error:"Invalid request."},400);}
 const email=String(data?.email||"").trim().toLowerCase();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return output({error:"Valid checkout email required."},400);
 return lookup(data.orderId,"lower(email)",email);
}
