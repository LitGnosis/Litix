import {bundleDB,hashToken,response,safeEquals} from "../../../../lib/bundleOrders.mjs";
import {growthBundle,configuredWhatsApp,bundleWhatsappMessage,BUNDLE_INSTRUCTIONS} from "../../../../lib/growthBundles.mjs";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(req){
 const u=new URL(req.url),id=u.searchParams.get("id"),token=u.searchParams.get("token");
 if(!/^lbg_[0-9a-f-]{36}$/.test(String(id||""))||!token||token.length>180)return response({error:"Invalid private tracking link"},400);
 try{
  const sql=bundleDB();
  const rows=await sql.query("select id,package_id,package_name,platform,price_cents,payment_state,order_state,max_posts,tracking_token_hash,created_at from litix_growth_bundle_orders where id=$1",[id]);
  if(!rows.length||!safeEquals(hashToken(token),rows[0].tracking_token_hash))return response({error:"Order not found"},404);
  const order=rows[0];
  const posts=await sql.query("select post_url,status,allocations from litix_growth_bundle_posts where order_id=$1 order by created_at",[id]);
  const pending=await sql.query("select d.kind,d.quantity,d.supplier_order_id,d.status,p.post_url from litix_growth_bundle_dispatch d join litix_growth_bundle_posts p on p.id=d.post_id where p.order_id=$1 order by d.attempted_at",[id]);
  const num=configuredWhatsApp(),pkg=growthBundle(order.package_id);
  return response({
   order:{id:order.id,package:order.package_name,platform:order.platform,amount:(order.price_cents/100).toFixed(2),
    payment:order.payment_state,status:order.order_state,maxPosts:order.max_posts,createdAt:order.created_at},
   whatsappUrl:num&&pkg?"https://wa.me/"+num+"?text="+encodeURIComponent(bundleWhatsappMessage(pkg,id)):null,
   instructions:BUNDLE_INSTRUCTIONS,
   posts:posts.map(p=>({url:p.post_url,status:p.status,allocations:p.allocations})),
   deliveries:pending.map(p=>({url:p.post_url,kind:p.kind,quantity:p.quantity,supplierOrderId:p.supplier_order_id,status:p.status}))
  });
 }catch{return response({error:"Tracking is temporarily unavailable"},503);}
}
