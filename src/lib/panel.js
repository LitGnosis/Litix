import crypto from 'crypto';
import { db, audit } from './db';
import { currentUser } from './auth';
import {
  getServices, getServiceById, normalizeTarget, retailCents, providerCost, providerCostUsd,
  submitProviderOrder, getProviderOrderStatus, requestProviderRefill, getProviderRefillStatus,
  requestProviderCancel, markupMultiplier
} from './provider';

const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const makeId = prefix => `${prefix}_${crypto.randomUUID()}`;
export {encodedServiceKey,decodeServiceKey} from './serviceKey';
import {encodedServiceKey,decodeServiceKey} from './serviceKey';
import {fulfillPaidOrder} from './orders';
import {normalizeDeliveryPlan,applySpeedPrice} from './delivery';

export function requireAccount(req) {
  const user = currentUser(req);
  if (!user) { const e = new Error('Sign in required'); e.status = 401; throw e; }
  return user;
}

export async function createApiKey(user, label='Default') {
  const raw = `lx_${crypto.randomBytes(28).toString('base64url')}`;
  const id = makeId('key');
  const sql = db();
  await sql`insert into litix_api_keys (id, customer_id, key_hash, key_prefix, label, active, created_at) values (${id}, ${user.sub}, ${sha256(raw)}, ${raw.slice(0,10)}, ${String(label||'Default').slice(0,80)}, true, now())`;
  await audit('api_key_created','api_key',id,{customerId:user.sub});
  return { id, key: raw, prefix: raw.slice(0,10), label:String(label||'Default').slice(0,80) };
}

export async function listApiKeys(user) {
  const sql = db();
  return sql`select id,key_prefix,label,active,last_used_at,created_at,revoked_at from litix_api_keys where customer_id=${user.sub} order by created_at desc`;
}
export async function revokeApiKey(user, id) {
  const sql = db();
  const rows = await sql`update litix_api_keys set active=false,revoked_at=now() where id=${id} and customer_id=${user.sub} returning id`;
  return Boolean(rows[0]);
}
export async function authenticateApiKey(raw) {
  if (!raw) return null;
  const sql = db();
  const rows = await sql`select id,customer_id from litix_api_keys where key_hash=${sha256(raw)} and active=true limit 1`;
  const row = rows[0];
  if (!row) return null;
  await sql`update litix_api_keys set last_used_at=now() where id=${row.id}`;
  const users = await sql`select id,email,name from litix_customers where id=${row.customer_id} limit 1`;
  const u = users[0];
  return u ? { sub:u.id,email:u.email,name:u.name||'',apiKeyId:row.id } : null;
}

export async function wallet(user) {
  const sql = db();
  await sql`insert into litix_wallets (customer_id,currency,balance_cents,created_at,updated_at) values (${user.sub},'USD',0,now(),now()) on conflict (customer_id) do nothing`;
  const rows = await sql`select customer_id,currency,balance_cents,created_at,updated_at from litix_wallets where customer_id=${user.sub}`;
  const tx = await sql`select id,type,amount_cents,currency,status,payment_provider,payment_reference,order_id,created_at from litix_wallet_transactions where customer_id=${user.sub} order by created_at desc limit 50`;
  return { ...rows[0], transactions: tx };
}

export async function syncCatalog(){const services=await getServices(),sql=db();await sql`update litix_service_catalog set active=false where active=true`;for(const svc of services)await sql`insert into litix_service_catalog(id,provider,provider_service_id,platform,kind,tier,public_name,supplier_name,currency,provider_rate,provider_rate_usd,retail_rate_usd,min_qty,max_qty,service_type,refill,cancel,dripfeed,delivery_key,delivery_label,delivery_rank,raw,active,synced_at) values(${svc.publicId},${svc.provider},${svc.providerServiceId},${svc.platform},${svc.kind},${svc.quality},${svc.name},${svc.originalName||svc.name},${svc.currency},${svc.providerRate},${svc.providerRateUsd},${svc.retailRateUsd},${svc.min},${svc.max},${svc.type||'Default'},${Boolean(svc.refill)},${Boolean(svc.cancel)},${Boolean(svc.dripfeed)},${svc.deliveryKey||null},${svc.deliveryLabel||null},${Number(svc.deliveryRank||9)},${JSON.stringify(svc.raw||{})}::jsonb,true,now()) on conflict(id) do update set provider=excluded.provider,provider_service_id=excluded.provider_service_id,platform=excluded.platform,kind=excluded.kind,tier=excluded.tier,public_name=excluded.public_name,supplier_name=excluded.supplier_name,currency=excluded.currency,provider_rate=excluded.provider_rate,provider_rate_usd=excluded.provider_rate_usd,retail_rate_usd=excluded.retail_rate_usd,min_qty=excluded.min_qty,max_qty=excluded.max_qty,service_type=excluded.service_type,refill=excluded.refill,cancel=excluded.cancel,dripfeed=excluded.dripfeed,delivery_key=excluded.delivery_key,delivery_label=excluded.delivery_label,delivery_rank=excluded.delivery_rank,raw=excluded.raw,active=true,synced_at=now()`;return services}

async function debitWallet(user, amountCents, orderId) {
  const sql = db();
  const rows = await sql`update litix_wallets set balance_cents=balance_cents-${amountCents},updated_at=now() where customer_id=${user.sub} and balance_cents>=${amountCents} returning balance_cents`;
  if (!rows[0]) { const e=new Error('Insufficient wallet balance'); e.code='INSUFFICIENT_FUNDS'; e.status=402; throw e; }
  const id=makeId('wtx');
  await sql`insert into litix_wallet_transactions (id,customer_id,type,amount_cents,currency,status,payment_provider,payment_reference,order_id,metadata,created_at,updated_at) values (${id},${user.sub},'order_debit',${-amountCents},'USD','completed','wallet',${id},${orderId},'{}'::jsonb,now(),now())`;
  return id;
}
async function refundWallet(user, amountCents, orderId, reason) {
  const sql=db(); const id=makeId('wtx');
  await sql`update litix_wallets set balance_cents=balance_cents+${amountCents},updated_at=now() where customer_id=${user.sub}`;
  await sql`insert into litix_wallet_transactions (id,customer_id,type,amount_cents,currency,status,payment_provider,payment_reference,order_id,metadata,created_at,updated_at) values (${id},${user.sub},'order_refund',${amountCents},'USD','completed','wallet',${id},${orderId},${JSON.stringify({reason})}::jsonb,now(),now())`;
}

export async function placeWalletOrder(user,input){const service=await getServiceById(input.serviceId);if(!service){const e=new Error('Service unavailable');e.status=400;throw e}const quantity=Math.floor(Number(input.quantity));if(!Number.isFinite(quantity)||quantity<service.min||quantity>service.max){const e=new Error(`Quantity must be between ${service.min} and ${service.max}`);e.status=400;throw e}const target=normalizeTarget(service,input.target||input.link||input.username);let plan;try{plan=normalizeDeliveryPlan(input,service,quantity)}catch(e){e.status=400;throw e}const total=applySpeedPrice(retailCents(service,quantity),plan.speed),orderId=makeId('lx'),sql=db();await wallet(user);const debitId=await debitWallet(user,total,orderId);try{await sql`insert into litix_supplier_orders(id,service_id,service_name,target_link,quantity,provider_currency,provider_rate,provider_cost,provider_cost_usd,retail_cents,markup,payment_status,fulfillment_status,customer_id,customer_email,payment_provider,payment_reference,refill_eligible,cancel_eligible,auto_refill_enabled,refill_expires_at,delivery_speed,fulfillment_mode,scheduled_for,delivery_runs,delivery_interval_minutes,delivery_meta,created_at,updated_at) values(${orderId},${encodedServiceKey(service)},${service.name},${target},${quantity},${service.currency},${service.providerRate},${providerCost(service,quantity)},${providerCostUsd(service,quantity)},${total},${markupMultiplier()},'paid','pending',${user.sub},${user.email},'wallet',${debitId},${Boolean(service.refill)},${Boolean(service.cancel)},${Boolean(service.refill)},${service.refill?new Date(Date.now()+30*86400000).toISOString():null},${plan.speed},${plan.mode},${plan.scheduledFor||null},${plan.runs},${plan.intervalMinutes},${JSON.stringify({platform:service.platform,kind:service.kind,quality:service.quality})}::jsonb,now(),now())`;await fulfillPaidOrder(orderId);return(await sql`select * from litix_supplier_orders where id=${orderId}`)[0]}catch(e){await sql`update litix_wallets set balance_cents=balance_cents+${total},updated_at=now() where customer_id=${user.sub}`;throw e}}

export async function accountOrders(user, limit=100) {
  const sql=db();
  return sql`select id,service_id,service_name,target_link,quantity,retail_cents,payment_status,fulfillment_status,provider_order_id,provider_status,provider_remains,start_count,refill_eligible,cancel_eligible,created_at,updated_at from litix_supplier_orders where customer_id=${user.sub} or lower(customer_email)=lower(${user.email}) order by created_at desc limit ${Math.min(250,Math.max(1,Number(limit)||100))}`;
}

export async function refreshOrderStatus(user, orderId) {
  const sql=db();
  const rows=await sql`select * from litix_supplier_orders where id=${orderId} and (customer_id=${user.sub} or lower(customer_email)=lower(${user.email})) limit 1`;
  const order=rows[0]; if(!order) return null;
  if (!order.provider_order_id) return order;
  const {provider}=decodeServiceKey(order.service_id);
  try {
    const s=await getProviderOrderStatus(order.provider_order_id,provider);
    const status=String(s?.status||order.provider_status||'Pending');
    const remains=Number.isFinite(Number(s?.remains))?Number(s.remains):order.provider_remains;
    const startCount=Number.isFinite(Number(s?.start_count))?Number(s.start_count):order.start_count;
    const fulfillment=/complete/i.test(status)?'completed':/partial/i.test(status)?'partial':/cancel/i.test(status)?'cancelled':/progress|processing/i.test(status)?'in_progress':'submitted';
    const updated=await sql`update litix_supplier_orders set provider_status=${status},provider_remains=${remains},start_count=${startCount},fulfillment_status=${fulfillment},last_reconciled_at=now(),updated_at=now() where id=${order.id} returning *`;
    return updated[0];
  } catch(err) { return order; }
}

export async function requestRefill(user, orderId) {
  const order=await refreshOrderStatus(user,orderId); if(!order) {const e=new Error('Order not found');e.status=404;throw e;}
  if(!order.refill_eligible){const e=new Error('Refill is not available for this service');e.status=400;throw e;}
  if(!order.provider_order_id){const e=new Error('Order has not reached the supplier yet');e.status=409;throw e;}
  const {provider}=decodeServiceKey(order.service_id); const data=await requestProviderRefill(order.provider_order_id,provider);
  const refillId=String(data?.refill??data?.id??''); if(!refillId) throw new Error('Supplier did not return a refill ID');
  const id=makeId('rfl'); const sql=db();
  await sql`insert into litix_refills (id,order_id,customer_id,provider,provider_refill_id,status,created_at,updated_at) values (${id},${order.id},${user.sub},${provider},${refillId},'Pending',now(),now())`;
  return { refill:id, providerRefillId:refillId };
}
export async function refillStatus(user, refillId) {
  const sql=db(); const rows=await sql`select * from litix_refills where id=${refillId} and customer_id=${user.sub} limit 1`; const refill=rows[0]; if(!refill)return null;
  if(!refill.provider_refill_id)return refill;
  try { const s=await getProviderRefillStatus(refill.provider_refill_id,refill.provider); const status=String(s?.status||refill.status); const u=await sql`update litix_refills set status=${status},updated_at=now() where id=${refill.id} returning *`;return u[0]; } catch { return refill; }
}
export async function requestCancel(user, orderId) {
  const order=await refreshOrderStatus(user,orderId); if(!order){const e=new Error('Order not found');e.status=404;throw e;}
  if(!order.cancel_eligible){const e=new Error('Cancellation is not available for this service');e.status=400;throw e;}
  if(!order.provider_order_id){const e=new Error('Order has not reached the supplier yet');e.status=409;throw e;}
  const {provider}=decodeServiceKey(order.service_id); const data=await requestProviderCancel(order.provider_order_id,provider);
  const id=makeId('can'); const sql=db(); const status=String(data?.status||'Requested');
  await sql`insert into litix_cancellations (id,order_id,customer_id,provider,status,created_at,updated_at) values (${id},${order.id},${user.sub},${provider},${status},now(),now())`;
  return { cancellation:id,status };
}
