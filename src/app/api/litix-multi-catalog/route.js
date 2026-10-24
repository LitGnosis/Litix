import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const truth = v => v === true || String(v).toLowerCase() === "true" || String(v) === "1";
const labelOf = x => [x.name, x.category, x.description, x.desc, x.notes, x.terms].map(v => String(v || "")).join(" ");
const hasRefill = x => truth(x.refill) || truth(x.refillable) || truth(x.auto_refill) || truth(x.autorefill);
const hasNoDrop = x => /no[ -]?drop|non[ -]?drop|drop[ -]?protection|no[ -]?drop guarantee|non[ -]?drop guarantee/i.test(labelOf(x)) ||
  truth(x.no_drop) || truth(x.noDrop) || truth(x.drop_protection) || truth(x.no_drop_guarantee);
const platformOf = x => {
  const s = String(x.name || "") + " " + String(x.category || "");
  if (/instagram|\big\b/i.test(s)) return "Instagram";
  if (/tiktok/i.test(s)) return "TikTok";
  if (/youtube/i.test(s)) return "YouTube";
  if (/facebook|\bfb\b/i.test(s)) return "Facebook";
  if (/spotify/i.test(s)) return "Spotify";
  if (/twitter|\bx\b/i.test(s)) return "X";
  if (/linkedin/i.test(s)) return "LinkedIn";
  return "Other";
};

let cache = { at: 0, items: [] };

async function getCatalog() {
  if (cache.items.length && Date.now() - cache.at < 120000) return cache.items;
  const key = process.env.SMMGLOB_API_KEY;
  if (!key) throw new Error("Supplier credential is not configured");
  const endpoint = new URL(process.env.SMMGLOB_API_URL || "https://smmglob.com/api/v2");
  if (endpoint.protocol !== "https:" || !["smmglob.com", "www.smmglob.com"].includes(endpoint.hostname)) throw new Error("Supplier endpoint is invalid");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key, action: "services" }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("Supplier returned HTTP " + response.status);
  const raw = await response.json();
  if (!Array.isArray(raw)) throw new Error("Supplier catalog response is invalid");
  const items = raw.filter(x => {
    const label = labelOf(x);
    const meta = [x.country, x.region, x.location, x.geo, x.audience, x.target, x.service_type].map(v => String(v || "")).join(" ");
    const regular = /^(default|regular|standard)$/i.test(String(x.type || "Default")) || /\b(regular|standard)\b/i.test(label);
    const usa = /(\busa\b|u\.s\.a\.|united states|american|\bus\b)/i.test(label + " " + meta);
    const outsideUS = /(?:usa\s*mix|mix\s*usa|worldwide|global|international|(?:usa|u\.s\.a\.|united states|\bus\b)\s*[/,+&-]\s*(?:uk|u\.k\.|united kingdom|asia|europe|canada|australia|worldwide|global)|(?:uk|u\.k\.|united kingdom|asia|europe|canada|australia)\s*[/,+&-]\s*(?:usa|u\.s\.a\.|united states|\bus\b))/i;
    const mixedGeography = outsideUS.test(label + " " + meta);
    return x.service != null && Number(x.rate) > 0 && Number(x.min) > 0 && Number(x.max) >= Number(x.min) && regular && usa && !mixedGeography && hasRefill(x) && hasNoDrop(x);
  }).map(x => ({
    id: String(x.service),
    provider: "smmglob",
    service: String(x.service),
    name: String(x.name || "Service").slice(0, 200),
    category: String(x.category || "Other"),
    type: String(x.type || "Default"),
    platform: platformOf(x),
    min: Number(x.min),
    max: Number(x.max),
    refill: hasRefill(x),
    noDrop: hasNoDrop(x),
    retailPer1000Cents: Math.ceil(Number(x.rate) * 700)
  }));
  cache = { at: Date.now(), items };
  return items;
}

export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "custom";
  const platform = url.searchParams.get("platform") || "";
  const query = (url.searchParams.get("q") || "").toLowerCase().slice(0, 120);
  const page = Math.max(1, Math.min(10000, Number(url.searchParams.get("page")) || 1));
  if (!["custom", "auto"].includes(mode)) return NextResponse.json({ error: "Invalid catalog mode", items: [], total: 0 }, { status: 400 });
  try {
    const all = await getCatalog();
    const filtered = all.filter(x =>
      (!platform || platform === "All" || x.platform === platform) &&
      (!query || [x.name, x.category, x.platform].some(v => v.toLowerCase().includes(query)))
    );
    return NextResponse.json({
      items: filtered.slice((page - 1) * 24, page * 24),
      categories: [...new Set(filtered.map(x => x.category))].sort(),
      total: filtered.length,
      allCount: all.length,
      page,
      provider: "smmglob"
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Litix catalog unavailable", String(error?.message || error).slice(0, 120));
    return NextResponse.json({ items: [], categories: [], total: 0, allCount: 0, page, error: "Live U.S. catalog temporarily unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
