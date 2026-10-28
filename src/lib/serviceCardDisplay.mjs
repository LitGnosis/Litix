// Customer-facing display only. The original service object and backend mapping
// remain unchanged for checkout, supported quantities, tracking and fulfillment.
const TECHNICAL = [
  /\b(?:low|medium|high|premium)\s+quality\b/gi,
  /\b(?:no[\s-]*)?non[\s-]*drop(?:\s+claim)?\b/gi,
  /\b\d+\s*(?:days?|months?)\s+(?:of\s+)?refills?\b/gi,
  /\b(?:no\s+)?refills?(?:\s+(?:support|available|eligible|guaranteed|claim))?\b/gi,
  /\b\d+(?:[,.]\d+)?\s*[kKmM]?\s*(?:\/|per\s+)\s*day\b/gi,
  /\b(?:instant|high\s+speed|medium\s+speed|fast\s+(?:speed|delivery))\b/gi,
  /#?\b(?:boostero|smmglob|smmfollowom)[_-]?\d+\b/gi,
  /\b(?:boostero|smmglob|smmfollowom)\b/gi,
  /#\s*\d{3,}\b/g,
];
const SCRUB_EMOJIS = /[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0E\uFE0F\u200D\u20E3]/gu;
const compact = value => String(value||"").replace(/\s+/g," ").trim();

function cleanPiece(value) {
  let text = String(value||"").replace(SCRUB_EMOJIS,"");
  for (const rule of TECHNICAL) text = text.replace(rule," ");
  return compact(text.replace(/^[\s.:/|,;()[\]{}–—\-]+|[\s.:/|,;()[\]{}–—\-]+$/g,""));
}
export function publicServiceCardName(service){
  // Prefer the actual named product; the category is only a readable fallback.
  const source = String(service?.name??"").slice(0,400);
  let name = source.replace(/\[[^\]]*]/g,match=>{
    const value=match.slice(1,-1).split("|").map(cleanPiece).filter(Boolean);
    return value.length?" "+value.join(" ")+" ":" ";
  });
  name = name.split("|").map(cleanPiece).filter(Boolean).join(" / ");
  name = name.replace(/\bIG\b/gi,"Instagram").replace(/\bTik[\s-]*Tok\b/gi,"TikTok");
  name = compact(name.replace(/\s*\/\s*\/\s*/g," / "));
  if(!name)name=cleanPiece(service?.category).replace(/\bIG\b/gi,"Instagram");
  return name||"Social media service";
}
