import { unstable_cache } from 'next/cache';
import crypto from 'crypto';
import { adapterBalance, adapterServices, adapterSubmitOrder, adapterOrderStatus, adapterStandardAction } from './providerAdapters';
import { reserveRouteCapable } from './reserveManager';
const DEFAULT_NGN_PER_USD = Number(process.env.PROVIDER_NGN_PER_USD || 1331.013867);
const ALLOWED_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'X', 'Spotify', 'Telegram', 'Discord', 'Twitch', 'LinkedIn', 'Kick'];
const ALLOWED_QUALITIES = ['Regular', 'High Quality', 'Real', 'Auto', 'Active'];
const ALLOWED_KINDS = ['Followers', 'Likes', 'Views', 'Impressions', 'Shares', 'Reposts', 'Comments', 'Subscribers', 'Members', 'Reactions', 'Saves', 'Plays'];

const truthy = v => ['true','1','yes','y','on','enabled'].includes(String(v ?? '').toLowerCase());
const falsy = v => ['false','0','no','n','off','disabled'].includes(String(v ?? '').toLowerCase());

function configs() {
  return [
    {id:'smmglob',name:'SMM GLOB',adapter:'standard',url:process.env.SMMGLOB_API_URL||'https://smmglob.com/api/v2',key:process.env.SMMGLOB_API_KEY,enabled:!['false','0','off','disabled'].includes(String(process.env.SMMGLOB_PROVIDER_ENABLED??'true').toLowerCase()),currency:'USD',usdRate:1,priority:4},

    {id:'leofame',name:'LeoFame',adapter:'standard',url:process.env.LEOFAME_API_URL||'https://leofame.in/api/v2',key:process.env.LEOFAME_API_KEY,enabled:String(process.env.LEOFAME_PROVIDER_ENABLED??'true').toLowerCase()!=='false',currency:'USD',usdRate:1,priority:Number(process.env.LEOFAME_PROVIDER_PRIORITY||5)},
    {id:'crowdlume',name:'Crowdlume',adapter:'crowdlume',url:process.env.CROWDLUME_API_URL||'https://crowdlume.com/api/v1',key:process.env.CROWDLUME_API_KEY,enabled:String(process.env.CROWDLUME_PROVIDER_ENABLED??'true').toLowerCase()!=='false',currency:'USD',usdRate:1,priority:Number(process.env.CROWDLUME_PROVIDER_PRIORITY||10)},
    {id:'nexar',name:'Nexar',adapter:'nexar',url:process.env.NEXAR_API_URL||'https://resellers.nexarhq.com/api/v1/reseller',key:process.env.NEXAR_API_KEY,enabled:String(process.env.NEXAR_PROVIDER_ENABLED??'true').toLowerCase()!=='false',currency:'USD',usdRate:1,priority:Number(process.env.NEXAR_PROVIDER_PRIORITY||15)},
    {id:'boostify',name:'Boostify',adapter:'boostify',url:process.env.BOOSTIFY_API_URL||'https://rest.boostify.co/api/v1',key:process.env.BOOSTIFY_API_KEY,enabled:String(process.env.BOOSTIFY_PROVIDER_ENABLED??'true').toLowerCase()!=='false',currency:'USD',usdRate:1,priority:Number(process.env.BOOSTIFY_PROVIDER_PRIORITY||20)},
    {id:'smmpet',name:'smm.pet',adapter:'standard',url:process.env.SMMPET_API_URL||'https://smm.pet/api/v2',key:process.env.SMMPET_API_KEY,enabled:String(process.env.SMMPET_PROVIDER_ENABLED??'true').toLowerCase()!=='false',currency:'USD',usdRate:1,priority:Number(process.env.SMMPET_PROVIDER_PRIORITY||25)},
    {id:'owlet',name:'Owlet',adapter:'standard',url:process.env.THEOWLET_API_URL||'https://the-owlet.com/api/v2',key:process.env.THEOWLET_API_KEY,enabled:String(process.env.THEOWLET_PROVIDER_ENABLED??'true').toLowerCase()!=='false',currency:String(process.env.THEOWLET_PROVIDER_CURRENCY||'NGN').toUpperCase(),usdRate:Number(process.env.THEOWLET_NGN_PER_USD||DEFAULT_NGN_PER_USD),priority:Number(process.env.THEOWLET_PROVIDER_PRIORITY||30)},
    {id:'smmcenter',name:'SMM Center',adapter:'standard',url:process.env.SMMCENTER_API_URL||'https://smm-center.com/api/v2',key:process.env.SMMCENTER_API_KEY,enabled:String(process.env.SMMCENTER_PROVIDER_ENABLED??'true').toLowerCase()!=='false',currency:'USD',usdRate:1,priority:Number(process.env.SMMCENTER_PROVIDER_PRIORITY||40)},
    {id:'lolasmm',name:'LOLASMM',adapter:'standard',url:process.env.LOLASMM_API_URL||'https://lolasmm.com/api/v2',key:process.env.LOLASMM_API_KEY,enabled:String(process.env.LOLASMM_PROVIDER_ENABLED??'true').toLowerCase()!=='false',currency:'USD',usdRate:1,priority:Number(process.env.LOLASMM_PROVIDER_PRIORITY||45)},
    {id:'reliablesmm',name:'ReliableSMM',adapter:'standard',url:process.env.RELIABLESMM_API_URL||'https://reliablesmm.com/api/v2',key:process.env.RELIABLESMM_API_KEY,enabled:String(process.env.RELIABLESMM_PROVIDER_ENABLED??'true').toLowerCase()!=='false',currency:'USD',usdRate:1,priority:Number(process.env.RELIABLESMM_PROVIDER_PRIORITY||50)},
    {id:'smmworld',name:'SMM World',adapter:'standard',url:process.env.SMMWORLD_API_URL||'https://my.smmworld.org/api/v2',key:process.env.SMMWORLD_API_KEY,enabled:String(process.env.SMMWORLD_PROVIDER_ENABLED??'true').toLowerCase()!=='false',currency:'USD',usdRate:1,priority:Number(process.env.SMMWORLD_PROVIDER_PRIORITY||55),requestFormat:'json'},
    {id:'backup',name:process.env.BACKUP_SMM_PROVIDER_NAME||'Backup',adapter:'standard',url:process.env.BACKUP_SMM_API_URL,key:process.env.BACKUP_SMM_API_KEY,enabled:true,currency:String(process.env.BACKUP_SMM_PROVIDER_CURRENCY||'USD').toUpperCase(),usdRate:Number(process.env.BACKUP_SMM_CURRENCY_PER_USD||1),priority:70}
  ].filter(p=>p.enabled&&p.url&&p.key).sort((a,b)=>a.priority-b.priority);
}

export function getProvider(id) {
  return configs().find(p => p.id === id) || null;
}
export function providerEnabled() { return configs().length > 0; }
export function availableProviders() { return configs().map(({key, ...p}) => p); }

async function callProvider(providerId, action, extra = {}) {
  const provider = getProvider(providerId) || configs()[0];
  if (!provider) throw new Error('Supplier is not configured');
  const body = new URLSearchParams({ key: provider.key, action, ...Object.fromEntries(Object.entries(extra).filter(([,v]) => v !== undefined && v !== null && v !== '').map(([k,v]) => [k, String(v)])) });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.SMM_PROVIDER_TIMEOUT_MS || 18000));
  try {
    const response = await fetch(provider.url, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
      cache: 'no-store', signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text || `Supplier HTTP ${response.status}` }; }
    if (!response.ok) throw new Error(data?.error || `Supplier HTTP ${response.status}`);
    if (data?.error) throw new Error(String(data.error));
    return data;
  } finally { clearTimeout(timer); }
}

export async function getProviderBalance(providerId){const p=getProvider(providerId)||configs()[0];if(!p)throw new Error('Supplier is not configured');const d=await adapterBalance(p),balance=Number(d.balance),currency=String(d.currency||p.currency||'USD').toUpperCase();if(!Number.isFinite(balance))throw new Error('Invalid supplier balance');return{provider:p.id,balance,currency}}

export async function getRawServices(providerId){const p=getProvider(providerId)||configs()[0];if(!p)throw new Error('Supplier is not configured');const d=await adapterServices(p);if(!Array.isArray(d))throw new Error('Invalid services');return d}

function detectPlatform(text) {
  const t = text.toLowerCase();
  if (t.includes('instagram')) return 'Instagram';
  if (t.includes('tiktok') || t.includes('tik tok')) return 'TikTok';
  if (t.includes('youtube')) return 'YouTube';
  if (t.includes('facebook')) return 'Facebook';
  if (t.includes('twitter') || /(^|\s)x(\s|$)/i.test(text)) return 'X';
  if (t.includes('spotify')) return 'Spotify';
  if (t.includes('telegram')) return 'Telegram';
  if (t.includes('discord')) return 'Discord';
  if (t.includes('twitch')) return 'Twitch';
  if (t.includes('linkedin')) return 'LinkedIn';
  if (t.includes('kick')) return 'Kick';
  return null;
}
function detectKind(text) {
  const t = text.toLowerCase();
  if (t.includes('subscriber')) return 'Subscribers';
  if (t.includes('follower')) return 'Followers';
  if (t.includes('member')) return 'Members';
  if (t.includes('comment')) return 'Comments';
  if (t.includes('repost') || t.includes('retweet')) return 'Reposts';
  if (t.includes('share')) return 'Shares';
  if (t.includes('reaction')) return 'Reactions';
  if (t.includes('save')) return 'Saves';
  if (t.includes('play')) return 'Plays';
  if (t.includes('like')) return 'Likes';
  if (t.includes('impression') || /(^|\s)reach(\s|$)/i.test(text)) return 'Impressions';
  if (t.includes('view')) return 'Views';
  return null;
}
function detectQuality(text) {
  const t = text.toLowerCase();
  if (/(auto|subscription)/.test(t)) return 'Auto';
  if (/(active|organic)/.test(t)) return 'Active';
  if (/(real|organic|hq real)/.test(t)) return 'Real';
  if (/(high quality|hq|premium)/.test(t)) return 'High Quality';
  return 'Regular';
}
function boolCapability(raw, key, text, positive, negative) {
  const value = raw?.[key];
  if (negative.test(text)) return false;
  if (typeof value === 'boolean') return value;
  if (falsy(value)) return false;
  if (truthy(value)) return true;
  return positive.test(text);
}
function deliveryFrom(text, average) {
  const t = `${text} ${average || ''}`.toLowerCase();
  if (t.includes('instant') || t.includes('0-1 hour') || t.includes('1 hour') || t.includes('1h')) return { key: '1h', label: 'Fast delivery', rank: 1 };
  if (t.includes('6 hour') || t.includes('6h')) return { key: '6h', label: 'Usually starts within 6 hours', rank: 2 };
  if (t.includes('12 hour') || t.includes('12h')) return { key: '12h', label: 'Usually starts within 12 hours', rank: 3 };
  if (t.includes('24 hour') || t.includes('1 day') || t.includes('24h')) return { key: '24h', label: 'Usually starts within 24 hours', rank: 4 };
  if (t.includes('48 hour') || t.includes('2 day') || t.includes('48h')) return { key: '48h', label: 'Usually starts within 48 hours', rank: 5 };
  return { key: 'standard', label: average ? `Standard delivery • ${average}` : 'Standard delivery', rank: 9 };
}

export function markupMultiplier() { return 15; }
function rateToUsd(rate, currency, provider) {
  if (currency === 'USD') return rate;
  if (currency === 'NGN') return rate / (Number(provider?.usdRate) || DEFAULT_NGN_PER_USD);
  const divisor = Number(provider?.usdRate || 1);
  return rate / (divisor > 0 ? divisor : 1);
}

function publicServiceId(providerId, providerServiceId) {
  const hex = crypto.createHash('sha1').update(`${providerId}:${providerServiceId}`).digest('hex').slice(0,8);
  return String((parseInt(hex, 16) % 1900000000) + 100000000);
}

export function normalizeService(raw, providerId = 'owlet') {
  const provider = getProvider(providerId) || { id: providerId, name: providerId, currency: String(raw.currency || 'USD').toUpperCase(), usdRate: 1 };
  const name = String(raw.name || raw.service_name || raw.title || '').trim();
  const category = String(raw.category || '').trim();
  const combined = `${category} ${name}`;
  const platform = detectPlatform(combined);
  const kind = detectKind(name) || detectKind(category);
  if (!platform || !kind || !ALLOWED_PLATFORMS.includes(platform) || !ALLOWED_KINDS.includes(kind)) return null;
  const quality = detectQuality(combined);
  if (!ALLOWED_QUALITIES.includes(quality)) return null;
  const rate = Number(raw.rate);
  const min = Number(raw.min ?? 1);
  const max = Number(raw.max ?? 1000000);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  const currency = String(raw.currency || provider.currency || 'USD').toUpperCase();
  const providerRateUsd = rateToUsd(rate, currency, provider);
  const isPackage = /package/i.test(String(raw.type || '')) || (max === 1 && min === 1);
  const retailRateUsd = providerRateUsd * markupMultiplier();
  const delivery = deliveryFrom(combined, raw.average_time || raw.average);
  const refill = boolCapability(raw, 'refill', combined, /refill|drop protection/i, /refill\s*:\s*no|no\s*refill|\bNR\b/i);
  const cancel = boolCapability(raw, 'cancel', combined, /cancel/i, /cancel\s*:\s*no|no\s*cancel/i);
  const dripfeed = boolCapability(raw, 'dripfeed', combined, /drip\s*-?\s*feed|dripfeed/i, /drip\s*-?\s*feed\s*:\s*no|no\s*drip/i);
  return {
    id: providerId === 'owlet' ? String(raw.service ?? raw.id) : `${providerId}:${raw.service ?? raw.id}`,
    publicId: publicServiceId(providerId, String(raw.service ?? raw.id)),
    provider: providerId, providerName: provider.name, providerServiceId: String(raw.service ?? raw.id),
    name: `${platform} ${kind} • ${quality}`, originalName: name, category,
    platform, kind, quality, type: String(raw.type || 'Default'),
    providerRate: rate, providerRateUsd, retailRateUsd, currency, min, max, isPackage,
    deliveryKey: delivery.key, deliveryLabel: delivery.label, deliveryRank: delivery.rank,
    refill, cancel, dripfeed,
    subscription: /subscription|auto/i.test(String(raw.type || combined)),
  };
}

async function getServicesUncached() {
  const providers = configs();
  if (!providers.length) throw new Error('Supplier is not configured');
  const results = await Promise.all(providers.map(async p => {
    try { return (await getRawServices(p.id)).map(r => normalizeService(r, p.id)).filter(Boolean); }
    catch (err) { console.error('provider_services_failed', p.id, err?.message || err); return []; }
  }));
  const all = results.flat();
  const seen = new Map();
  for (const svc of all) {
    const key = `${svc.platform}|${svc.kind}|${svc.quality}`;
    const prev = seen.get(key);
    if (!prev || svc.retailRateUsd < prev.retailRateUsd || (svc.retailRateUsd === prev.retailRateUsd && svc.deliveryRank < prev.deliveryRank)) seen.set(key, svc);
  }
  return [...seen.values()].sort((a,b) => ALLOWED_PLATFORMS.indexOf(a.platform) - ALLOWED_PLATFORMS.indexOf(b.platform) || ALLOWED_KINDS.indexOf(a.kind) - ALLOWED_KINDS.indexOf(b.kind) || ALLOWED_QUALITIES.indexOf(a.quality) - ALLOWED_QUALITIES.indexOf(b.quality));
}

const getCachedCatalog=unstable_cache(
 async()=>{const services=await getServicesUncached(); if(!services.length)throw new Error("All supplier catalog requests failed");return services;},
 ["litix-supplier-catalog-verified-20261016"],{revalidate:300}
);
export async function getServices(){return getCachedCatalog();}
export async function getServiceById(id) {
  const value = String(id || '');
  if (/^\d{9,10}$/.test(value)) {
    const services = await getServices();
    return services.find(s => s.publicId === value) || null;
  }
  const colon = value.indexOf(':');
  const providerId = colon > 0 ? value.slice(0, colon) : 'owlet';
  const providerServiceId = colon > 0 ? value.slice(colon + 1) : value;
  const provider = getProvider(providerId);
  if (!provider) return null;
  const raw = (await getRawServices(provider.id)).find(x => String(x.service ?? x.id) === providerServiceId);
  return raw ? normalizeService(raw, provider.id) : null;
}

export async function resolveFundedRoute({service=null,serviceName='',quantity,retailCents,speedPolicy='standard',excludeProviders=[]}){const qty=Math.floor(Number(quantity));if(!qty)return null;const blocked=new Set(excludeProviders.map(String)),ps=configs().filter(p=>!blocked.has(p.id)),priority=new Map(ps.map(p=>[p.id,p.priority]));const groups=await Promise.all(ps.map(async p=>{try{return(await getRawServices(p.id)).map(r=>normalizeService(r,p.id)).filter(Boolean)}catch{return[]}}));let c=groups.flat().filter(s=>qty>=s.min&&qty<=s.max&&(service?(s.platform===service.platform&&s.kind===service.kind&&s.quality===service.quality):s.name===String(serviceName)));const floor=Math.max(0,Math.min(95,Number(process.env.LITIX_MIN_GROSS_MARGIN_PCT||15))),max=Number(retailCents)>0?Number(retailCents)/100*(1-floor/100):Infinity;c=c.filter(s=>providerCostUsd(s,qty)<=max);const balances=new Map();await Promise.all(ps.map(async p=>{try{balances.set(p.id,await getProviderBalance(p.id))}catch{}}));c=c.filter(s=>{const b=balances.get(s.provider);return b&&String(b.currency).toUpperCase()===String(s.currency).toUpperCase()&&Number(b.balance)>=providerCost(s,qty)});c.sort((a,b)=>speedPolicy==='express'?((a.deliveryRank||9)-(b.deliveryRank||9)||((priority.get(a.provider)||999)-(priority.get(b.provider)||999))):((priority.get(a.provider)||999)-(priority.get(b.provider)||999)||providerCostUsd(a,qty)-providerCostUsd(b,qty)));const x=c[0];return x?{service:x,balance:balances.get(x.provider),providerCost:providerCost(x,qty),providerCostUsd:providerCostUsd(x,qty)}:null}
export async function resolveReserveRoute({service=null,serviceName='',quantity,retailCents,speedPolicy='standard',excludeProviders=[]}){const qty=Math.floor(Number(quantity));if(!qty)return null;const blocked=new Set(excludeProviders.map(String)),ps=configs().filter(p=>!blocked.has(p.id)&&reserveRouteCapable(p.id)),priority=new Map(ps.map(p=>[p.id,p.priority]));const groups=await Promise.all(ps.map(async p=>{try{return(await getRawServices(p.id)).map(r=>normalizeService(r,p.id)).filter(Boolean)}catch{return[]}}));let c=groups.flat().filter(s=>String(s.currency).toUpperCase()==='USD'&&qty>=s.min&&qty<=s.max&&(service?(s.platform===service.platform&&s.kind===service.kind&&s.quality===service.quality):s.name===String(serviceName)));const floor=Math.max(0,Math.min(95,Number(process.env.LITIX_MIN_GROSS_MARGIN_PCT||15))),max=Number(retailCents)>0?Number(retailCents)/100*(1-floor/100):Infinity;c=c.filter(s=>providerCostUsd(s,qty)<=max);c.sort((a,b)=>speedPolicy==='express'?((a.deliveryRank||9)-(b.deliveryRank||9)||((priority.get(a.provider)||999)-(priority.get(b.provider)||999))):((priority.get(a.provider)||999)-(priority.get(b.provider)||999)||providerCostUsd(a,qty)-providerCostUsd(b,qty)));const x=c[0];if(!x)return null;let balance=null;try{balance=await getProviderBalance(x.provider)}catch{}return{service:x,balance,providerCost:providerCost(x,qty),providerCostUsd:providerCostUsd(x,qty),reserveRequired:true}}

export function normalizeTarget(service, input) {
  const value = String(input || '').trim();
  if (!value) throw new Error('Enter a public username or URL');
  const profileKinds = new Set(['Followers','Subscribers','Members']);
  if (!profileKinds.has(service.kind)) {
    if (!/^https?:\/\//i.test(value)) throw new Error(`Enter the full public ${service.platform} post, video, page or content URL`);
    return value;
  }
  if (/^https?:\/\//i.test(value)) return value;
  const username = value.replace(/^@/, '').trim();
  if (!username) throw new Error('Enter a public username or profile URL');
  const map = {
    Instagram: `https://www.instagram.com/${username}/`, TikTok: `https://www.tiktok.com/@${username}`,
    YouTube: `https://www.youtube.com/@${username}`, Facebook: `https://www.facebook.com/${username}`,
    X: `https://x.com/${username}`, Telegram: `https://t.me/${username}`, Twitch: `https://twitch.tv/${username}`,
    LinkedIn: `https://www.linkedin.com/in/${username}`,
  };
  if (service.platform === 'Spotify') throw new Error('Enter the full public Spotify profile URL');
  return map[service.platform] || value;
}

export async function submitProviderOrder({provider='owlet',serviceId,target,quantity,runs,interval,comments,clientOrderId}){const p=getProvider(provider)||configs()[0];if(!p)throw new Error('Supplier is not configured');return adapterSubmitOrder(p,{serviceId,target,quantity,runs,interval,comments,clientOrderId:clientOrderId||`litix-${Date.now()}`})}
export async function getProviderOrderStatus(orderId,provider='owlet'){const p=getProvider(provider)||configs()[0];return adapterOrderStatus(p,orderId)}
export async function getProviderMultiStatus(ids,provider='owlet'){return adapterStandardAction(getProvider(provider)||configs()[0],'status',{orders:ids.join(',')})}
export async function requestProviderRefill(orderId,provider='owlet'){return adapterStandardAction(getProvider(provider)||configs()[0],'refill',{order:orderId})}
export async function requestProviderMultiRefill(ids,provider='owlet'){return adapterStandardAction(getProvider(provider)||configs()[0],'refill',{orders:ids.join(',')})}
export async function getProviderRefillStatus(id,provider='owlet'){return adapterStandardAction(getProvider(provider)||configs()[0],'refill_status',{refill:id})}
export async function getProviderMultiRefillStatus(ids,provider='owlet'){return adapterStandardAction(getProvider(provider)||configs()[0],'refill_status',{refills:ids.join(',')})}
export async function requestProviderCancel(orderId,provider='owlet'){return adapterStandardAction(getProvider(provider)||configs()[0],'cancel',{order:orderId})}

export function providerCost(service, quantity) {
  if (service.isPackage) return Number(service.providerRate);
  return Number(service.providerRate) * Number(quantity) / 1000;
}
export function providerCostUsd(service, quantity) {
  if (service.isPackage) return Number(service.providerRateUsd);
  return Number(service.providerRateUsd) * Number(quantity) / 1000;
}
export function providerCostNgn(service, quantity) {
  const cost = providerCost(service, quantity);
  if (service.currency === 'NGN') return cost;
  return providerCostUsd(service, quantity) * DEFAULT_NGN_PER_USD;
}
export function retailCents(service, quantity) { return Math.max(1, Math.round(providerCostUsd(service, quantity) * markupMultiplier() * 100)); }

export async function providerHealth() {
  const items = await Promise.all(configs().map(async p => {
    try { const b = await getProviderBalance(p.id); return { id:p.id, name:p.name, ok:true, balance:b.balance, currency:b.currency }; }
    catch (err) { return { id:p.id, name:p.name, ok:false, error:String(err?.message || err) }; }
  }));
  return items;
}
