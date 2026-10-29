import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { sendOrderEmails, notificationsConfigured } from "../../../lib/orderNotifications.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const send = (v,s=200) => Response.json(v,{status:s,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const hash = v => createHash("sha256").update(String(v)).digest("hex");
const conn = () => process.env.LITIX_V2_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
const db = () => neon(conn());
// Preview/Development payment requests are sandbox-only; production retains its existing gateway.
const selectedGatewayMode = () => ["preview","development"].includes(process.env.VERCEL_ENV) || process.env.NMI_GATEWAY_MODE === "TEST" ? "TEST" : "PRODUCTION";
const publicCollectKey = () => selectedGatewayMode()==="TEST"
  ? (process.env.NEXT_PUBLIC_PAYKINGS_NMI_TEST_COLLECT_PUBLIC_KEY || process.env.NMI_TEST_COLLECT_PUBLIC_KEY)
  : (process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY || process.env.PAYKINGS_NMI_COLLECT_PUBLIC_KEY);
const sandboxGatewayValid = () => {
  try { const u=new URL(process.env.NMI_TEST_GATEWAY_URL||"");return u.protocol==="https:"&&u.hostname!=="paykings.transactiongateway.com" }catch{return false}
};
const paymentConfigured = () => selectedGatewayMode()==="TEST"
  ? Boolean(process.env.NMI_TEST_SECURITY_KEY && sandboxGatewayValid() && publicCollectKey())
  : Boolean(process.env.NMI_SECURITY_KEY && publicCollectKey());
const conf = () => ({database:!!conn(),supplier:process.env.LITIX_BOOSTERO_ENABLED==="true"&&!!process.env.BOOSTERO_API_KEY,payment:paymentConfigured()});
const name = req => new URL(req.url).pathname.split("/").pop();
const bounded = (v,n=120) => String(v??"").trim().slice(0,n);

const publicOrderId=id=>/^ltx2_[a-f0-9-]{36}$/.test(id);
const normalizeSupplierState=(state,current)=>{
 const s=String(state||"").trim().toLowerCase().replace(/[ _-]+/g," ");
 if(["completed","complete","finished"].includes(s))return "completed";
 if(["partial","partially completed"].includes(s))return "partial";
 if(["canceled","cancelled","refunded","failed","error"].includes(s))return s==="cancelled"?"canceled":s;
 if(["in progress","inprogress","working"].includes(s))return "in_progress";
 if(["processing","running"].includes(s))return "processing";
 if(["pending","waiting","queued","awaiting"].includes(s))return "pending";
 return current;
};
const publicOrder=(x,refresh={})=>{
 const stat=x.last_supplier_status||{};
 const remaining=stat.remains==null?null:Number(stat.remains);
 const validRemaining=Number.isFinite(remaining)&&Number.isInteger(remaining)&&remaining>=0&&remaining<=Number(x.quantity)?remaining:null;
 const supplierStatus=String(stat.status||"").trim();
 return {id:x.id,service:x.service_name,quantity:Number(x.quantity),amount:(Number(x.amount_cents)/100).toFixed(2),payment:x.payment_state,fulfillment:x.fulfillment_state,supplierOrderId:x.supplier_order_id||null,status:supplierStatus||null,remains:validRemaining,checkedAt:stat.checked_at||null,liveSupplierStatus:refresh.live===true,deliveryConfirmed:x.fulfillment_state==="completed",statusNote:refresh.warning||(!supplierStatus?"Supplier accepted the order; delivery is not confirmed yet.":"Supplier status is based on its most recent response.")};
};
async function refreshSupplierOrder(sql,x){
 // Only live Boostero orders may use the saved Boostero fulfillment record.
 // Historical orders retain their last persisted status without contacting
 // the retired supplier or mutating customer data.
 try{
  const provider=await sql.query(
   "select state,supplier_order_id,supplier_status,checked_at from public.litix_boostero_fulfillment where litix_order_id=$1",
   [x.id]);
  if(provider.length){
   const b=provider[0],mapped=String(b.state||"").toLowerCase();
   x.fulfillment_state=mapped==="submitted"?"processing":mapped==="unknown_outcome"?"manual_review":mapped;
   x.supplier_order_id=b.supplier_order_id||null;
   x.last_supplier_status={...b.supplier_status,provider:"boostero",
    checked_at:b.checked_at||b.supplier_status?.checked_at||null};
   return {live:false,warning:"Showing the last saved Boostero status. Delivery is not independently confirmed."};
  }
 }catch{return {live:false,warning:"Tracking is temporarily unavailable. Saved order history remains unchanged."};}
 return {live:false,warning:"Historical order: showing last saved status. No retired supplier requests are made."};
}

// Keep this check local: legacy numeric checkout is also loaded by the
// existing standalone no-charge gateway regression harness.
export async function GET(req){
 const op=name(req),flags=conf(),p=new URL(req.url).searchParams;
 if(!["config","health","smmservices","track"].includes(op))return send({error:"Unknown route"},404);
 if(op==="config")return send({ready:flags.database&&flags.supplier&&flags.payment,publicKey:publicCollectKey()||null});
 if(op==="health"){let database=false;if(flags.database)try{await db().query("select 1",[]);database=true}catch{}const gatewayMode=selectedGatewayMode();const gatewayConfigured=gatewayMode==="TEST"?!!(process.env.NMI_TEST_SECURITY_KEY&&process.env.NMI_TEST_GATEWAY_URL):!!process.env.NMI_SECURITY_KEY;return send({service:"litix-v2",database,supplierConfigured:flags.supplier,paykingsConfigured:flags.payment,orderEmailConfigured:notificationsConfigured(),gatewayMode,testGatewayConfigured:gatewayMode==="TEST"?gatewayConfigured:undefined,liveTransactionVerified:false,ready:database&&flags.supplier&&flags.payment},database?200:503)}
 if(op==="smmservices"){
  // Deprecated legacy API. The public catalog is /api/catalog/v1, Boostero only.
  return send({error:"Retired catalog disabled. Use the verified public catalog.",items:[],total:0},410);
 }

 if(op==="track"){
  const id=bounded(p.get("id"),80),secret=bounded(p.get("token"),150);
  if(!publicOrderId(id)||secret.length<25||secret.length>150)return send({error:"Invalid private tracking link"},400);
  let rows,sql;
  try{sql=db();rows=await sql.query("select id,service_name,quantity,amount_cents,payment_state,fulfillment_state,supplier_order_id,last_supplier_status from litix_v2_orders where id=$1 and tracking_token_hash=$2",[id,hash(secret)])}
  catch{return send({error:"Tracking database temporarily unavailable"},503)}
  if(!rows.length)return send({error:"Order not found"},404);
  const x=rows[0],refresh=await refreshSupplierOrder(sql,x);
  return send({order:publicOrder(x,refresh)});
 }
}
async function resendPaidOrderConfirmation(req){
 if(!notificationsConfigured())return send({error:"Email sending is temporarily unavailable"},503);
 let payload;
 try{payload=await req.json()}catch{return send({error:"Invalid request"},400)}
 const id=bounded(payload?.orderId,80),token=bounded(payload?.token,150);
 if(!/^ltx2_[a-f0-9-]{36}$/.test(id)||token.length<25)return send({error:"Invalid private tracking link"},400);
 let rows;
 try{rows=await db().query("select id,email,quantity,amount_cents,service_name,fulfillment_state,payment_state from litix_v2_orders where id=$1 and tracking_token_hash=$2",[id,hash(token)])}
 catch{return send({error:"Tracking is temporarily unavailable"},503)}
 const order=rows?.[0];
 if(!order||order.payment_state!=="paid")return send({error:"No paid order found for this tracking link"},404);
 after(()=>sendOrderEmails({orderId:id,secret:token,email:String(order.email),amountCents:Number(order.amount_cents),quantity:Number(order.quantity),serviceName:String(order.service_name),fulfillment:String(order.fulfillment_state),notifyOwner:false}).catch(e=>console.error("Litix manual resend failed",{orderId:id,error:String(e?.message||"email error").slice(0,100)})));
 return send({queued:true,message:"Confirmation and tracking email request accepted"},202);
}

async function lookupOrderByEmail(req){
 let raw;
 try{raw=await req.text();if(raw.length>1100)throw Error("oversized")}catch{return send({error:"Invalid request"},400)}
 let data;try{data=JSON.parse(raw)}catch{return send({error:"Invalid request"},400)}
 const id=bounded(data?.orderId,80),email=bounded(data?.email,254).toLowerCase();
 if(!publicOrderId(id)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return send({error:"Enter the order number and checkout email."},400);
 let rows,sql;
 try{sql=db();rows=await sql.query("select id,service_name,quantity,amount_cents,payment_state,fulfillment_state,supplier_order_id,last_supplier_status from litix_v2_orders where id=$1 and lower(email)=$2 limit 1",[id,email])}
 catch{return send({error:"Order lookup is temporarily unavailable"},503)}
 if(!rows.length)return send({error:"No matching order found. Check the number and email used at checkout."},404);
 const x=rows[0],refresh=await refreshSupplierOrder(sql,x);
 return send({order:publicOrder(x,refresh)});
}
// Historical lookup/resend routes remain available; retired purchases cannot be charged.
export async function POST(req){
 const action=name(req);
 if(action==="lookup-order")return lookupOrderByEmail(req);
 if(action==="resend-confirmation")return resendPaidOrderConfirmation(req);
 if(action==="checkout")return send({error:"Retired supplier checkout is disabled. Choose an approved Boostero service. No payment was attempted."},409);
 return send({error:"Unknown action"},404);
}
