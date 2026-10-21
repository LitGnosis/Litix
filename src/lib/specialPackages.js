import crypto from 'crypto';
import { db, audit } from './db';
import { currentUser } from './auth';
import { getServices, normalizeTarget } from './provider';
import { encodedServiceKey } from './serviceKey';
import { fulfillPaidOrder, getOrderById } from './orders';

const SOURCE_URL='https://teaserid.com/special-packages';
const PRICE_MULTIPLIER=1.5;
const qualityRank=['High Quality','Real','Active','Regular','Auto'];

export const SPECIAL_PACKAGES=[
  {id:'ig_launch',platform:'Instagram',tier:'Launch',fallback:29.90,marker:'Instagram 25,000 Likes',items:{Likes:25000,Views:100000,Impressions:10000,Shares:1000,Saves:1000,Reposts:100}},
  {id:'ig_momentum',platform:'Instagram',tier:'Momentum',fallback:59.90,marker:'Instagram 50,000 Likes',items:{Likes:50000,Views:250000,Impressions:25000,Shares:2500,Saves:2500,Reposts:250}},
  {id:'ig_power',platform:'Instagram',tier:'Power',fallback:109.90,marker:'Instagram 100,000 Likes',items:{Likes:100000,Views:500000,Impressions:50000,Shares:5000,Saves:5000,Reposts:500}},
  {id:'ig_apex',platform:'Instagram',tier:'Apex',fallback:199.90,marker:'Instagram 250,000 Likes',items:{Likes:250000,Views:1000000,Impressions:100000,Shares:10000,Saves:10000,Reposts:1000}},
  {id:'tt_launch',platform:'TikTok',tier:'Launch',fallback:24.90,marker:'TikTok 10,000 Likes',items:{Likes:10000,Views:100000,Shares:5000,Saves:2500}},
  {id:'tt_momentum',platform:'TikTok',tier:'Momentum',fallback:49.90,marker:'TikTok 25,000 Likes',items:{Likes:25000,Views:250000,Shares:10000,Saves:5000}},
  {id:'tt_power',platform:'TikTok',tier:'Power',fallback:94.90,marker:'TikTok 50,000 Likes',items:{Likes:50000,Views:500000,Shares:25000,Saves:10000}},
  {id:'tt_apex',platform:'TikTok',tier:'Apex',fallback:179.90,marker:'TikTok 100,000 Likes',items:{Likes:100000,Views:1000000,Shares:50000,Saves:25000}},
];

function moneyCents(n){return Math.round(Number(n)*100)}
function packageName(p){return `${p.platform} ${p.tier} Bundle`}
function publicItems(items){return Object.entries(items).map(([kind,quantity])=>({kind,quantity}))}
function extractPrice(html, marker, fallback){
  const i=html.indexOf(marker); if(i<0)return fallback;
  const tail=html.slice(i,i+9000);
  const m=tail.match(/ozelpaket__inner-card-price[^>]*>\s*\$([0-9]+(?:\.[0-9]+)?)/i);
  const n=Number(m?.[1]); return Number.isFinite(n)&&n>0?n:fallback;
}
async function currentReferencePrices(){
  let html='';
  try{
    const r=await fetch(SOURCE_URL,{headers:{'user-agent':'Litix-Pricing/1.0'},next:{revalidate:21600},signal:AbortSignal.timeout(6000)});
    if(r.ok) html=await r.text();
  }catch{}
  return Object.fromEntries(SPECIAL_PACKAGES.map(p=>[p.id,extractPrice(html,p.marker,p.fallback)]));
}
function routeIsExact(service, kind){
  const raw=`${service.originalName||''} ${service.name||''}`.toLowerCase();
  if(/\b(dislike|comment\s*like|comments?\s*likes?|bundle|package|combo|mixed|all\s*in\s*one)\b/i.test(raw)) return false;
  const patterns={
    Likes:/\blikes?\b/i,
    Views:/\b(video\s*)?views?\b/i,
    Impressions:/\b(impressions?|reach)\b/i,
    Shares:/\bshares?\b/i,
    Saves:/\b(saves?|favorites?|bookmarks?)\b/i,
    Reposts:/\b(reposts?|retweets?)\b/i,
  };
  const p=patterns[kind]; if(!p||!p.test(raw)) return false;
  if(kind==='Views' && /story\s*views?|profile\s*views?|post\s*views?/i.test(raw)) return false;
  if(kind==='Likes' && /comment/i.test(raw)) return false;
  return true;
}
function chooseRoute(services,platform,kind){
  const exact=services.filter(s=>s.platform===platform&&s.kind===kind&&routeIsExact(s,kind));
  exact.sort((a,b)=>qualityRank.indexOf(a.quality)-qualityRank.indexOf(b.quality)||a.providerRateUsd-b.providerRateUsd);
  return exact[0]||null;
}
function canFullyRedeem(total,min,max){
  total=Math.floor(Number(total)); min=Math.max(1,Math.floor(Number(min))); max=Math.max(min,Math.floor(Number(max)));
  if(!Number.isFinite(total)||!Number.isFinite(min)||!Number.isFinite(max)||total<min)return false;
  const fewest=Math.ceil(total/max), most=Math.floor(total/min);
  return fewest<=most;
}
export async function packageCatalog(){
  const [prices,services]=await Promise.all([currentReferencePrices(),getServices()]); if(!services.length)throw new Error('Supplier catalog unavailable');
  return SPECIAL_PACKAGES.map(p=>{
    const routes=Object.fromEntries(Object.keys(p.items).map(k=>[k,chooseRoute(services,p.platform,k)]));
    const missing=Object.entries(routes).filter(([,v])=>!v).map(([k])=>k);
    const unredeemable=Object.entries(routes).filter(([kind,route])=>route&&!canFullyRedeem(p.items[kind],route.min,route.max)).map(([kind])=>kind);
    const referencePrice=prices[p.id]||p.fallback;
    const priceCents=moneyCents(referencePrice*PRICE_MULTIPLIER);
    const estimatedCostCents=moneyCents(Object.entries(routes).reduce((sum,[kind,route])=>sum+(route?Number(route.providerRateUsd||0)*Number(p.items[kind])/1000:0),0));
    const profitable=missing.length===0&&unredeemable.length===0&&priceCents>estimatedCostCents;
    return {id:p.id,platform:p.platform,tier:p.tier,name:packageName(p),priceCents,referencePriceCents:moneyCents(referencePrice),markupPercent:50,items:publicItems(p.items),available:profitable,missing:[...new Set([...missing,...unredeemable])],profitProtected:true};
  });
}
export async function packageById(id){return (await packageCatalog()).find(p=>p.id===String(id))||null}
function requireUser(req){const u=currentUser(req);if(!u){const e=new Error('Sign in required');e.status=401;throw e;}return u}
export { requireUser as requirePackageUser };

export async function packagePurchases(user){
  const sql=db();
  const purchases=await sql`select id,package_id,package_name,platform,price_cents,status,created_at,updated_at from litix_package_purchases where customer_id=${user.sub} order by created_at desc limit 100`;
  const out=[];
  for(const p of purchases){
    const balances=await sql`select kind,total_quantity,remaining_quantity from litix_package_balances where purchase_id=${p.id} order by kind`;
    out.push({...p,balances});
  }
  return out;
}

export async function purchasePackageWithWallet(user,packageId){
  const pkg=await packageById(packageId); if(!pkg){const e=new Error('Package not found');e.status=404;throw e;}
  if(!pkg.available){const e=new Error('This package is temporarily unavailable while fulfillment routes are being verified.');e.status=503;throw e;}
  const sql=db();
  await sql`insert into litix_wallets (customer_id,currency,balance_cents,created_at,updated_at) values (${user.sub},'USD',0,now(),now()) on conflict(customer_id) do nothing`;
  const charged=await sql`update litix_wallets set balance_cents=balance_cents-${pkg.priceCents},updated_at=now() where customer_id=${user.sub} and balance_cents>=${pkg.priceCents} returning balance_cents`;
  if(!charged[0]){const e=new Error('Insufficient Litix wallet balance');e.status=402;e.code='INSUFFICIENT_FUNDS';throw e;}
  const id=`pkg_${crypto.randomUUID()}`; const def=SPECIAL_PACKAGES.find(x=>x.id===pkg.id);
  try{
    await sql`insert into litix_package_purchases (id,customer_id,email,package_id,package_name,platform,price_cents,reference_price_cents,markup_percent,payment_provider,payment_reference,status,created_at,updated_at) values (${id},${user.sub},${user.email},${pkg.id},${pkg.name},${pkg.platform},${pkg.priceCents},${pkg.referencePriceCents},50,'wallet',${id},'active',now(),now())`;
    for(const [kind,quantity] of Object.entries(def.items)) await sql`insert into litix_package_balances (purchase_id,kind,total_quantity,remaining_quantity,created_at,updated_at) values (${id},${kind},${quantity},${quantity},now(),now())`;
    const tx=`wtx_${crypto.randomUUID()}`;
    await sql`insert into litix_wallet_transactions (id,customer_id,type,amount_cents,currency,status,payment_provider,payment_reference,metadata,created_at,updated_at) values (${tx},${user.sub},'package_debit',${-pkg.priceCents},'USD','completed','wallet',${id},${JSON.stringify({packageId:pkg.id,packageName:pkg.name})}::jsonb,now(),now())`;
    await audit('package_purchased','package',id,{packageId:pkg.id,priceCents:pkg.priceCents});
    return {id,package:pkg,balanceCents:charged[0].balance_cents};
  }catch(err){await sql`update litix_wallets set balance_cents=balance_cents+${pkg.priceCents},updated_at=now() where customer_id=${user.sub}`;throw err;}
}

export async function redeemPackage(user,{purchaseId,kind,target,quantity}){
  const q=Math.floor(Number(quantity)); if(!Number.isFinite(q)||q<1){const e=new Error('Enter a valid quantity');e.status=400;throw e;}
  const sql=db(); const purchase=(await sql`select * from litix_package_purchases where id=${String(purchaseId)} and customer_id=${user.sub} and status='active' limit 1`)[0];
  if(!purchase){const e=new Error('Package not found');e.status=404;throw e;}
  const services=await getServices(); const route=chooseRoute(services,purchase.platform,String(kind));
  if(!route){const e=new Error(`${kind} fulfillment is temporarily unavailable for this package.`);e.status=503;throw e;}
  if(q<route.min||q>route.max){const e=new Error(`Quantity must be between ${route.min.toLocaleString()} and ${route.max.toLocaleString()} for this fulfillment route.`);e.status=400;throw e;}
  const normalized=normalizeTarget(route,target);
  const reserved=await sql`update litix_package_balances set remaining_quantity=remaining_quantity-${q},updated_at=now() where purchase_id=${purchase.id} and kind=${String(kind)} and remaining_quantity>=${q} returning remaining_quantity`;
  if(!reserved[0]){const e=new Error(`Not enough ${kind} remaining in this package.`);e.status=409;throw e;}
  const orderId=`ltx_${crypto.randomUUID()}`,redemptionId=`red_${crypto.randomUUID()}`;
  try{
    const meta={platform:route.platform,kind:route.kind,quality:route.quality};
    await sql`insert into litix_supplier_orders(id,service_id,service_name,target_link,quantity,provider_currency,provider_rate,provider_cost,provider_cost_usd,retail_cents,markup,customer_id,customer_email,payment_status,fulfillment_status,payment_provider,payment_reference,refill_eligible,cancel_eligible,auto_refill_enabled,refill_expires_at,delivery_speed,fulfillment_mode,delivery_runs,delivery_interval_minutes,delivery_meta,created_at,updated_at) values(${orderId},${encodedServiceKey(route)},${route.name},${normalized},${q},${route.currency},${route.providerRate},${route.providerRate*q/1000},${route.providerRateUsd*q/1000},0,0,${user.sub},${user.email},'paid','pending','package_credit',${purchase.id},${Boolean(route.refill)},${Boolean(route.cancel)},${Boolean(route.refill)},${route.refill?new Date(Date.now()+30*86400000).toISOString():null},'standard','instant',1,0,${JSON.stringify(meta)}::jsonb,now(),now())`;
    await fulfillPaidOrder(orderId);
    const order=await getOrderById(orderId);
    await sql`insert into litix_package_redemptions(id,purchase_id,customer_id,kind,quantity,target,order_id,provider_order_id,status,created_at,updated_at) values(${redemptionId},${purchase.id},${user.sub},${String(kind)},${q},${normalized},${orderId},${order?.provider_order_id||null},${order?.fulfillment_status||'pending'},now(),now())`;
    const left=await sql`select count(*)::int as n from litix_package_balances where purchase_id=${purchase.id} and remaining_quantity>0`;
    if(Number(left[0]?.n||0)===0)await sql`update litix_package_purchases set status='used',updated_at=now() where id=${purchase.id}`;
    await audit('package_redeemed','package',purchase.id,{kind,quantity:q,orderId,providerOrderId:order?.provider_order_id||null});
    return{orderId,redemptionId,providerOrderId:order?.provider_order_id||null,fulfillmentStatus:order?.fulfillment_status||'pending',remaining:Number(reserved[0].remaining_quantity)};
  }catch(err){await sql`update litix_package_balances set remaining_quantity=remaining_quantity+${q},updated_at=now() where purchase_id=${purchase.id} and kind=${String(kind)}`;throw err;}
}
