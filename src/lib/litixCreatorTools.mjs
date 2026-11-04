// Deterministic, private, browser-only templates; intentionally not represented as AI output.
const trim=(x,n=100)=>typeof x==="string"?x.trim().replace(/\s+/g," ").slice(0,n):"";
export const CAPTION_PLATFORMS=Object.freeze(["Instagram","TikTok","YouTube","Facebook","LinkedIn","X"]);
export const CAPTION_TONES=Object.freeze(["Clear","Friendly","Energetic","Professional"]);
export function buildCaptionIdeas(values){
 const business=trim(values?.business,80);
 const audience=trim(values?.audience,110);
 const offer=trim(values?.offer,170);
 const action=trim(values?.action,110);
 const tone=trim(values?.tone,30);
 const platform=trim(values?.platform,30);
 if(business.length<2||audience.length<2||offer.length<4||action.length<3||
  !CAPTION_TONES.includes(tone)||!CAPTION_PLATFORMS.includes(platform))throw Error("Complete the business, audience, offer and action fields.");
 const style={Clear:"Straight to the point:",Friendly:"Here's something worth sharing:",Energetic:"Big news:",Professional:"An update from our team:"}[tone];
 return [
  {label:"Straightforward",text:`${business} helps ${audience} with ${offer}. ${action}.`},
  {label:"Benefit-first",text:`${audience}, looking for a practical next step? Explore ${offer} with ${business}. ${action}.`},
  {label:"Announcement",text:`${style} ${business} is sharing ${offer} for ${audience}. ${action}.`}
 ];
}
export function safeCreatorUrl(raw){
 try{const u=new URL(String(raw||"").trim());if(!["https:","http:"].includes(u.protocol)||u.username||u.password||!u.hostname.includes(".")||u.hostname.length>200)return null;
 if(/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(u.hostname))return null;
 return u.toString();
 }catch{return null}
}
export const escapeCreatorHtml=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
export function linkPageExport({name,tagline,links}){
 const title=trim(name,80),subtitle=trim(tagline,160);
 if(title.length<2)throw Error("Enter a display name.");
 const selected=(Array.isArray(links)?links:[]).map(p=>({label:trim(p?.label,70),url:safeCreatorUrl(p?.url)})).filter(p=>p.label&&p.url).slice(0,5);
 if(!selected.length)throw Error("Add at least one valid public http(s) link.");
 const items=selected.map(p=>`<a href="${escapeCreatorHtml(p.url)}" target="_blank" rel="noopener noreferrer nofollow">${escapeCreatorHtml(p.label)}</a>`).join("\n");
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeCreatorHtml(title)} — Links</title><style>body{margin:0;font:16px system-ui;background:linear-gradient(150deg,#030b17,#0a3350);color:#ecf9ff;min-height:100vh;display:grid;place-items:center}.wrap{max-width:520px;width:min(90vw,520px);text-align:center;padding:48px 0}h1{font-size:clamp(36px,8vw,58px);margin:0 0 12px}p{line-height:1.6;color:#abcde7;margin-bottom:32px}a{display:block;border:1px solid #86cef5;border-radius:14px;background:#123c59;color:#fff;padding:17px;margin:12px 0;text-decoration:none;font-weight:750}a:hover,a:focus-visible{background:#1e6183;outline:2px solid #b5ebff}</style></head><body><main class="wrap"><h1>${escapeCreatorHtml(title)}</h1><p>${escapeCreatorHtml(subtitle)}</p>${items}</main></body></html>`;
}
