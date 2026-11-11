import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 24;
let cache = { at: 0, items: [] };
const truth = value => value === true || String(value).toLowerCase() === "true" || String(value) === "1";
const textOf = value => String(value ?? "").trim();
const hasRefill = x => truth(x.refill) || truth(x.refillable) || truth(x.auto_refill) || truth(x.autorefill);
const hasNoDrop = x => {
  const label = [x.name, x.category, x.description, x.desc, x.notes, x.terms].map(textOf).join(" ");
  return /no[ -]?drop|non[ -]?drop|drop[ -]?protection/i.test(label) ||
    truth(x.no_drop) || truth(x.noDrop) || truth(x.drop_protection) || truth(x.no_drop_guarantee);
};
const platformOf = x => {
  const label = [x.name, x.category].map(textOf).join(" ");
  if (/instagram|\big\b/i.test(label)) return "Instagram";
  if (/tik[\s._-]*tok/i.test(label)) return "TikTok";
  if (/youtube/i.test(label)) return "YouTube";
  if (/facebook|\bfb\b/i.test(label)) return "Facebook";
  if (/spotify/i.test(label)) return "Spotify";
  if (/twitter|\bx\b/i.test(label)) return "X";
  if (/linkedin/i.test(label)) return "LinkedIn";
  return "Other";
};
const geoOf = x => [x.name, x.category, x.description, x.country, x.region, x.location, x.geo, x.target].map(textOf).join(" ").toLowerCase();
const geoRank = x => {
  const label = geoOf(x);
  if (/\b(usa|u\.?s\.?a?\.?|united states|american|us based)\b/.test(label)) return 0;
  if (/\b(global|worldwide|world wide|standard|international|all countries)\b/.test(label)) return 1;
  if (/\b(uk|united kingdom|canada|australia|germany|france|india|brazil|mexico|japan|korea|spain|italy|turkey|indonesia|philippines|pakistan|uae)\b/.test(label)) return 2;
  return 1;
};
const socialRank = x => {
  const label = geoOf(x);
  const ig = /\b(instagram|ig)\b/.test(label);
  const tt = /\btik[\s._-]*tok\b/.test(label);
  const follower = /\bfollowers?\b/.test(label);
  const likes = /\blikes?\b/.test(label);
  if (ig && follower && !likes) return 0;
  if (ig && likes && !follower) return 1;
  if (tt && follower && !likes) return 2;
  if (tt && likes && !follower) return 3;
  return 99;
};

async function loadCatalog() {
  if (cache.items.length && Date.now() - cache.at < 120000) return cache.items;
  const key = process.env.BOOSTERO_API_KEY;
  const endpoint = new URL(process.env.BOOSTERO_API_URL || "");
  if (!key || endpoint.protocol !== "https:" || endpoint.hostname !== "boostero.com" || endpoint.username || endpoint.password) {
    throw new Error("Boostero server configuration is incomplete");
  }
  // Boostero's v2 API requires application/x-www-form-urlencoded POST data.
  // Sending JSON here returns an API error rather than the service array.
  const body = new URLSearchParams({ key, action: "services" });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
  });
  const responseText = await response.text();
  let raw;
  try { raw = JSON.parse(responseText); }
  catch { throw new Error("Boostero returned non-JSON data (HTTP " + response.status + ")"); }
  if (!response.ok) {
    const reason = textOf(raw?.error || raw?.message).slice(0, 100);
    throw new Error("Boostero returned HTTP " + response.status + (reason ? ": " + reason : ""));
  }
  if (!Array.isArray(raw)) {
    const reason = textOf(raw?.error || raw?.message).slice(0, 100);
    throw new Error("Boostero catalog response was not an array" + (reason ? ": " + reason : ""));
  }
  const seen = new Set();
  const items = raw.filter(x => {
    const id = String(x?.service ?? "");
    const rate = Number(x?.rate), min = Number(x?.min), max = Number(x?.max);
    if (!/^\d+$/.test(id) || seen.has(id) || !Number.isFinite(rate) || rate <= 0 ||
        !Number.isSafeInteger(min) || min < 1 || !Number.isSafeInteger(max) || max < min) return false;
    seen.add(id);
    return true;
  }).map(x => ({
    id: String(x.service),
    name: textOf(x.name) || "Service",
    category: textOf(x.category) || "Other",
    type: textOf(x.type) || "Default",
    platform: platformOf(x),
    min: Number(x.min),
    max: Number(x.max),
    per1000: Number((Number(x.rate) * 2.5).toFixed(4)),
    refill: hasRefill(x),
    noDrop: hasNoDrop(x),
    purchasable: /^(default|regular|standard)$/i.test(textOf(x.type) || "Default"),
    country: textOf(x.country || x.region || x.location),
    geography: geoRank(x)
  })).sort((a, b) => {
    const sa = socialRank(a), sb = socialRank(b);
    return sa - sb || (sa === 99 ? 0 : a.geography - b.geography) ||
      a.per1000 - b.per1000 || a.name.localeCompare(b.name);
  });
  cache = { at: Date.now(), items };
  return items;
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const category = textOf(params.get("category"));
  const query = textOf(params.get("q")).toLowerCase().slice(0, 120);
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  try {
    const all = await loadCatalog();
    const filtered = all.filter(item =>
      (!category || item.category === category) &&
      (!query || [item.id, item.name, item.category, item.platform, item.country].some(v => String(v).toLowerCase().includes(query)))
    );
    const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return NextResponse.json({
      items,
      categories: [...new Set(all.map(x => x.category))].sort(),
      total: filtered.length,
      allCount: all.length,
      page,
      provider: "Boostero"
    }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    console.error("Litix Boostero catalog unavailable", String(error?.message || error).slice(0, 120));
    return NextResponse.json({
      items: [], categories: [], total: 0, allCount: 0, page,
      error: "Boostero live catalog is temporarily unavailable"
    }, { status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  }
}
