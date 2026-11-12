// LITIX AI's small, dependency-free pure helpers. No checkout or supplier mutations.
const secretWords = /\b(?:password|security code|cvv|full card number|api key|secret key|tracking token)\b/i;
export function redactForAI(value) {
  return String(value || "").slice(0, 900)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email withheld]")
    .replace(/\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g, "[phone withheld]")
    .replace(/\bltx2_[a-f0-9-]{36}\b/gi, "[order number withheld]")
    .replace(/\blbg_[a-f0-9-]{36}\b/gi, "[bundle order number withheld]")
    .replace(/\b(?:sk|rk|pk)_(?:live|test)_[a-z0-9]+\b/gi, "[credential withheld]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[payment number withheld]")
    .replace(/(?:token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "[credential withheld]")
    .trim();
}
export function cleanConversation(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-4).filter(x => x && (x.role === "user" || x.role === "assistant") && typeof x.content === "string")
    .map(x => ({role:x.role, content:redactForAI(x.content).slice(0, 600)}))
    .filter(x => x.content.length > 0);
}
export function catalogIntent(message) {
  const s = String(message || "").toLowerCase();
  const relevant = /\b(service|price|cost|rate|catalog|follower|like|view|share|comment|engagement|boost|promot|instagram|tiktok|youtube|facebook|spotify)\b/i.test(s);
  if (!relevant) return null;
  const platform = /\btik[\s-]?tok\b/i.test(s) ? "TikTok" : /\binstagram\b/i.test(s) ? "Instagram" : "";
  const kind = /\bfollowers?\b/.test(s) ? "followers" : /\blikes?\b/.test(s) ? "likes" : "";
  const terms = /\b(american|usa|u\.s\.|united states|us-targeted)\b/i.test(s) ? "usa" : "";
  return { platform, kind, terms };
}
export function needsGuardian(message) {
  return /\b(guardian|outage|incident|down|status|unavailable|alert|system|offline|maintenance)\b/i.test(String(message || ""));
}
export function needsBundles(message) {
  return /\b(bundle|package|launch|momentum|apex|power)\b/i.test(String(message || ""));
}
export function responseText(data) {
  if (!Array.isArray(data?.output)) return "";
  return data.output.flatMap(x => Array.isArray(x.content) ? x.content : [])
    .filter(x => x?.type === "output_text" && typeof x.text === "string")
    .map(x => x.text).join("\n").trim().slice(0, 1800);
}
export function textIsSensitive(message) {
  return secretWords.test(message) && /\b(?:my|here is|this is|i have|is:)\b/i.test(message);
}
