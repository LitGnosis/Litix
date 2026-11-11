const PROVIDER_NGN_PER_USD = Number(process.env.PROVIDER_NGN_PER_USD || 1331.013867);
const ALLOWED_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'X', 'Spotify', 'Telegram'];
const ALLOWED_QUALITIES = ['Regular', 'High Quality', 'Real', 'Auto', 'Active'];
const ALLOWED_KINDS = ['Followers', 'Likes', 'Views', 'Shares', 'Comments', 'Subscribers', 'Members'];

function endpoint() {
  return process.env.THEOWLET_API_URL || 'https://the-owlet.com/api/v2';
}
function key() {
  return process.env.THEOWLET_API_KEY;
}
export function providerEnabled() {
  return String(process.env.THEOWLET_PROVIDER_ENABLED ?? 'true').toLowerCase() !== 'false' && Boolean(key());
}

async function callProvider(action, extra = {}) {
  if (!providerEnabled()) throw new Error('Supplier is not configured');
  const body = new URLSearchParams({ key: key(), action, ...Object.fromEntries(Object.entries(extra).map(([k,v]) => [k, String(v)])) });
  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text || `Supplier HTTP ${response.status}` }; }
  if (!response.ok) throw new Error(data?.error || `Supplier HTTP ${response.status}`);
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function getProviderBalance() {
  const data = await callProvider('balance');
  const balance = Number(data?.balance ?? data?.amount ?? 0);
  const currency = String(data?.currency || 'NGN').toUpperCase();
  if (!Number.isFinite(balance)) throw new Error('Invalid supplier balance response');
  return { balance, currency };
}

export async function getRawServices() {
  const data = await callProvider('services');
  if (!Array.isArray(data)) throw new Error('Invalid supplier service response');
  return data;
}

function detectPlatform(text) {
  const t = text.toLowerCase();
  if (t.includes('instagram')) return 'Instagram';
  if (t.includes('tiktok') || t.includes('tik tok')) return 'TikTok';
  if (t.includes('youtube') || t.includes('you tube')) return 'YouTube';
  if (t.includes('facebook') || t.includes('fb ')) return 'Facebook';
  if (t.includes('twitter') || /(^|\s)x(\s|$)/.test(t)) return 'X';
  if (t.includes('spotify')) return 'Spotify';
  if (t.includes('telegram')) return 'Telegram';
  return null;
}

function detectKind(text) {
  const t = text.toLowerCase();
  if (t.includes('share') || t.includes('repost')) return 'Shares';
  if (t.includes('subscriber')) return 'Subscribers';
  if (t.includes('member')) return 'Members';
  if (t.includes('follower')) return 'Followers';
  if (t.includes('comment')) return 'Comments';
  if (t.includes('like') || t.includes('reaction')) return 'Likes';
  if (t.includes('view') || t.includes('impression') || t.includes('reach')) return 'Views';
  return null;
}

function detectQuality(text) {
  const t = text.toLowerCase();
  if (t.includes('high quality') || /\bhq\b/.test(t)) return 'High Quality';
  if (t.includes('real')) return 'Real';
  if (t.includes('active')) return 'Active';
  if (t.includes('auto')) return 'Auto';
  return 'Regular';
}

function deliveryFrom(text, average) {
  const t = `${text} ${average || ''}`.toLowerCase();
  if (t.includes('instant') || t.includes('0-1 hour') || t.includes('1 hour') || t.includes('1h')) return { key: '1h', label: 'Spread over 1 hour', rank: 1 };
  if (t.includes('6 hour') || t.includes('6h')) return { key: '6h', label: 'Spread over 6 hours', rank: 2 };
  if (t.includes('12 hour') || t.includes('12h')) return { key: '12h', label: 'Spread over 12 hours', rank: 3 };
  if (t.includes('24 hour') || t.includes('1 day') || t.includes('24h')) return { key: '24h', label: 'Spread over 24 hours', rank: 4 };
  if (t.includes('48 hour') || t.includes('2 day') || t.includes('48h')) return { key: '48h', label: 'Spread over 48 hours', rank: 5 };
  return { key: 'standard', label: average ? `Standard delivery • ${average}` : 'Standard delivery', rank: 9 };
}

export function markupMultiplier() {
  const n = Number(process.env.LITIX_RETAIL_MARKUP_MULTIPLIER || process.env.RETAIL_MARKUP_MULTIPLIER || 6);
  return Number.isFinite(n) && n >= 1 ? n : 6;
}

export function normalizeService(raw) {
  const name = String(raw.name || raw.service_name || raw.title || '').trim();
  const category = String(raw.category || '').trim();
  const combined = `${category} ${name}`;
  const platform = detectPlatform(combined);
  const kind = detectKind(combined);
  if (!platform || !kind || !ALLOWED_PLATFORMS.includes(platform) || !ALLOWED_KINDS.includes(kind)) return null;
  const quality = detectQuality(combined);
  if (!ALLOWED_QUALITIES.includes(quality)) return null;
  const rate = Number(raw.rate);
  const min = Number(raw.min ?? 1);
  const max = Number(raw.max ?? 1000000);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  const providerRateUsd = rate / PROVIDER_NGN_PER_USD;
  const retailRateUsd = providerRateUsd * markupMultiplier();
  const delivery = deliveryFrom(combined, raw.average_time || raw.average);
  return {
    id: String(raw.service ?? raw.id),
    name: `${platform} ${kind} • ${quality}`,
    originalName: name,
    platform,
    kind,
    quality,
    providerRate: rate,
    providerRateUsd,
    retailRateUsd,
    currency: 'NGN',
    min: Math.max(1, Math.floor(min)),
    max: Math.max(Math.floor(min), Math.floor(max)),
    deliveryKey: delivery.key,
    deliveryLabel: delivery.label,
    deliveryRank: delivery.rank,
    refill: Boolean(raw.refill) || /refill|drop protection/i.test(combined),
  };
}

export async function getServices() {
  const rows = (await getRawServices()).map(normalizeService).filter(Boolean);
  const seen = new Map();
  for (const svc of rows) {
    const key = [svc.platform, svc.kind, svc.quality, svc.deliveryKey].join('|');
    const prev = seen.get(key);
    if (!prev || svc.retailRateUsd < prev.retailRateUsd) seen.set(key, svc);
  }
  return [...seen.values()].sort((a,b) =>
    ALLOWED_PLATFORMS.indexOf(a.platform) - ALLOWED_PLATFORMS.indexOf(b.platform) ||
    ALLOWED_KINDS.indexOf(a.kind) - ALLOWED_KINDS.indexOf(b.kind) ||
    ALLOWED_QUALITIES.indexOf(a.quality) - ALLOWED_QUALITIES.indexOf(b.quality) ||
    a.deliveryRank - b.deliveryRank || a.retailRateUsd - b.retailRateUsd
  );
}

export async function getServiceById(id) {
  const raw = (await getRawServices()).find(x => String(x.service ?? x.id) === String(id));
  return raw ? normalizeService(raw) : null;
}

export function normalizeTarget(service, input) {
  const value = String(input || '').trim();
  if (!value) throw new Error('Enter a public profile or post link');
  const profileKinds = new Set(['Followers','Subscribers','Members']);
  if (!profileKinds.has(service.kind)) {
    if (!/^https?:\/\//i.test(value)) throw new Error('Enter the full public post or content URL');
    return value;
  }
  if (/^https?:\/\//i.test(value)) return value;
  const username = value.replace(/^@/, '').trim();
  if (!username) throw new Error('Enter a public username or profile URL');
  const enc = encodeURIComponent(username);
  const map = {
    Instagram: `https://www.instagram.com/${enc}/`,
    TikTok: `https://www.tiktok.com/@${enc}`,
    YouTube: `https://www.youtube.com/@${enc}`,
    Facebook: `https://www.facebook.com/${enc}`,
    X: `https://x.com/${enc}`,
    Telegram: `https://t.me/${enc}`,
  };
  if (service.platform === 'Spotify') throw new Error('Enter the full public Spotify profile URL');
  return map[service.platform] || value;
}

export async function submitProviderOrder({ serviceId, target, quantity }) {
  const data = await callProvider('add', { service: serviceId, link: target, quantity });
  const order = data?.order ?? data?.id;
  if (!order) throw new Error('Supplier did not return an order ID');
  return String(order);
}

export async function getProviderOrderStatus(providerOrderId) {
  return callProvider('status', { order: providerOrderId });
}

export function providerCostNgn(service, quantity) {
  return Number(service.providerRate) * Number(quantity) / 1000;
}

export function providerCostUsd(service, quantity) {
  return Number(service.providerRateUsd) * Number(quantity) / 1000;
}

export { ALLOWED_PLATFORMS, ALLOWED_QUALITIES, ALLOWED_KINDS };
