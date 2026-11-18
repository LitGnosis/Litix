// Display-only catalog metadata. Supplier identifiers and raw descriptions are
// kept out of public text. Never infer warranties, retention, or delivery SLAs.
const VERIFIED_VARIANTS=Object.freeze({
  // Descriptors verified against the Nov 14 Litix production catalog snapshot.
  litix_2132:{quality:"High quality",pace:"4K/day listed"},
  litix_3474:{quality:"Premium quality",pace:"5K/day listed"},
  litix_5093:{quality:"Active-look listing",pace:"5K/day listed"},
  litix_2133:{quality:"Active-account listing",pace:"1K/day listed"},
  litix_2131:{quality:"Active-account listing",pace:"2K/day listed"},
  litix_2145:{quality:"USA/UK specialty",pace:"50/day listed"},
  litix_2063:{pace:"5K/day listed"},
  // Verified source listing litix_2050 contains "Instagram Indonesia Followers 500/Day";
  // checkout choices remove speed from names, so retain it as display-only metadata.
  litix_2050:{pace:"500/day listed"}
});
const PLATFORM_TITLES=[
 ["Instagram",/\binstagram\b/gi],
 ["TikTok",/\btik[ -]?tok\b/gi],
 ["YouTube",/\byou[ -]?tube\b/gi],
 ["Facebook",/\bfacebook\b/gi],
 ["USA",/\bu\.?s\.?a\.?\b/gi],
 ["UK",/\bu\.?k\.?\b/gi]
];
const MAX_FAST_RATE_DEFAULT=250;
export const FAST_CHECKOUT_MAX_RATE=(()=>{
 const n=Number(process.env.NEXT_PUBLIC_LITIX_FAST_RATE_LIMIT||MAX_FAST_RATE_DEFAULT);
 return Number.isFinite(n)&&n>=20&&n<=10000?n:MAX_FAST_RATE_DEFAULT;
})();
export const QUANTITY_PRESETS=Object.freeze([250,500,1000,2500,5000]);
const money=value=>"$"+Number(value).toFixed(2);
const spacing=value=>String(value||"").replace(/\s+/g," ").trim();
// A trailing catalog speed is display metadata, not part of the public title.
const SPEED_SUFFIX=/(?:\s+|[|·–—-]\s*)(\d+(?:[,.]\d+)?\s*[kK]?\s*\/\s*day)\s*$/i;
function trailingSpeed(value){
 const trimmed=spacing(value).replace(/\s+(?:No\s+Drop|Non\s+Drop|Manual\s+Refills?)\s*$/i,"");
 return trimmed.match(SPEED_SUFFIX)?.[1]||"";
}

export function cleanCheckoutTitle(raw){
 let text=String(raw||"").replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0E\uFE0F\u200D\u20E3]/gu,"");
 // Bracketed supplier attributes are handled as *unverified listing metadata*.
 text=text.replace(/\[[^\]]*\]/g," ").replace(/\b(?:Boostero|SMMGLOB|SMMFOLLOWOM)(?:['’]s)?\b/gi,"");
 text=text.replace(/\bColumbia\b/gi,"Colombia");
 text=text.replace(/\bReal\b/gi,"Active");
 text=text.replace(/\b(?:No\s+Drop|Non\s+Drop|Manual\s+Refills?)\b/gi,"");
 text=text.replace(/\s+(?:Top\s+Pick|Recommended)\s*$/gi,"");
 text=text.replace(SPEED_SUFFIX,"");
 for(const [name,pattern] of PLATFORM_TITLES)text=text.replace(pattern,name);
 return spacing(text.replace(/^[\s.,:|–—➜>\-]+|[\s.,:|–—➜>\-]+$/g,""));
}
function rawDetails(source){
 const raw=String(source?.listingName||source?.rawName||"");
 if(!raw)return {};
 const data={};
 if(/\bPremium Quality\b/i.test(raw))data.quality="Premium quality";
 else if(/\bHigh Quality\b/i.test(raw))data.quality="High quality";
 else if(/\bSuper Real Accounts\b/i.test(raw))data.quality="Active-look listing";
 else if(/\bReal Accounts\b/i.test(raw))data.quality="Active-account listing";
 const pace=raw.match(/\b(\d+(?:[,.]\d+)?\s*[kK]?\s*\/\s*Day)\b/i);
 if(pace)data.pace=spacing(pace[1]).replace(/\s*\/\s*/,"/")+" listed";
 // "Manual refill" claims are deliberately not advertised. A raw service
 // caption or refill=false is not proof of eligibility or a guarantee.
 return data;
}
export function publicCheckoutTraits(raw){return rawDetails({listingName:raw});}

// Translate verified listing descriptors into buyer-friendly presentation text.
// Raw supplier metadata remains unchanged for pricing, eligibility and audits.
export function customerCheckoutQuality(quality){
 const value=String(quality||"");
 if(value==="Active-look listing")return "Real-Look Profiles";
 if(value==="Active-account listing")return "Premium Active Profiles";
 return value;
}
export function customerCheckoutPace(pace){
 const value=String(pace||"");
 const match=value.match(/^\s*(\d+(?:[,.]\d+)?)\s*(k?)\s*\/\s*day\s+listed\s*$/i);
 if(!match)return value;
 const amount=Number(match[1].replace(/,/g,""))*(match[2]?1000:1);
 return Number.isFinite(amount)&&amount>0
  ? "Up to "+amount.toLocaleString("en-US")+"/day"
  : value;
}
export function checkoutDisplay(row){
 const original=String(row?.name||"Litix service");
 const title=cleanCheckoutTitle(original);
 const provided={
  ...(/^(?:High quality|Premium quality|Active-look listing|Active-account listing)$/i.test(String(row?.variantQuality||""))?
   {quality:String(row.variantQuality)}:{}),
  ...(/^(?:\d+(?:[,.]\d+)?\s*[kK]?\s*\/\s*[Dd]ay listed)$/i.test(String(row?.variantPace||""))?
   {pace:String(row.variantPace)}:{})
 };
 const titleSpeed=trailingSpeed(original);
 const details={...(VERIFIED_VARIANTS[String(row?.id)]||{}),...provided,...rawDetails(row),
  ...(titleSpeed?{pace:spacing(titleSpeed).replace(/\s*\/\s*/,"/")+" listed"}:{})};
 const specifics=[customerCheckoutQuality(details.quality),customerCheckoutPace(details.pace)].filter(Boolean);
 const min=Number(row?.min)||1,max=Number(row?.max)||min;
 const specialty=Number(row?.per1000)>FAST_CHECKOUT_MAX_RATE;
 // Missing differences are not invented: use actual min/max and a stable
 // variant reference so two differently priced offers are distinguishable.
 const limit=min.toLocaleString("en-US")+"–"+max.toLocaleString("en-US")+" limit";
 const tierLabel=specifics.join(" · ");
 const subtitle=tierLabel
  ? tierLabel+(details.pace?"":" · "+limit)
  : "Standard service · "+limit;
 return {title,subtitle,tierLabel,specialty,tier:specialty?"Specialty / Custom":"Standard catalog",
  label:title+" · "+subtitle+" ("+money(row?.per1000||0)+"/1k)"};
}
const rankTarget=x=>/\bUSA(?:\s*\/\s*UK)?\b/i.test(cleanCheckoutTitle(x?.name))?0:1;
export function compareCheckoutCards(a,b){
 const kindA=String(a?.kind||""),kindB=String(b?.kind||"");
 if(kindA!==kindB)return kindA.localeCompare(kindB);
 const specialA=checkoutDisplay(a).specialty?1:0,specialB=checkoutDisplay(b).specialty?1:0;
 if(specialA!==specialB)return specialA-specialB;
 const aRank=rankTarget(a),bRank=rankTarget(b);
 if(aRank!==bRank)return aRank-bRank;
 return Number(a?.per1000)-Number(b?.per1000)||
  checkoutDisplay(a).title.localeCompare(checkoutDisplay(b).title)||
  String(a?.id).localeCompare(String(b?.id));
}
export function dedupeCheckoutCards(items){
 const unique=new Map();
 for(const item of Array.isArray(items)?items:[]){
  const d=checkoutDisplay(item);
  const signature=[
   item.platform,item.kind,d.title.toLocaleLowerCase("en"),d.subtitle.toLocaleLowerCase("en"),
   Number(item.per1000).toFixed(4),Number(item.min),Number(item.max),Number(item.unitStep||1)
  ].join("|");
  if(!unique.has(signature))unique.set(signature,item);
 }
 return [...unique.values()];
}
export function clampCheckoutQuantity(requested,service){
 if(!service)return 0;
 const min=Number(service.min),max=Number(service.max),step=Number(service.unitStep||1);
 const rate=Number(service.per1000);
 if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||max<min||
  !Number.isSafeInteger(step)||step<1||!Number.isFinite(rate)||rate<=0)return 0;
 const legalMinimum=Math.min(max,Math.max(min,Math.ceil(1000/rate)));
 const lower=Math.min(max,min+Math.ceil((legalMinimum-min)/step)*step);
 const raw=Number.isFinite(Number(requested))?Math.round(Number(requested)):lower;
 const limited=Math.max(lower,Math.min(max,raw));
 const aligned=min+Math.floor((limited-min)/step)*step;
 return Math.max(lower,Math.min(max,aligned));
}
export function defaultCheckoutQuantity(service){
 return clampCheckoutQuantity(1000,service);
}
export function quoteCentsForQuantity(service,quantity){
 if(!service||!Number.isSafeInteger(Number(quantity))||Number(quantity)<Number(service.min)||
  Number(quantity)>Number(service.max)||((Number(quantity)-Number(service.min))%Number(service.unitStep||1))!==0)return null;
 const curated=String(service.id||"").startsWith("curated_");
 if(curated){
  const card=service.quantityCards?.find(c=>c.quantity===Number(quantity));
  if(card)return card.available===true&&Number.isSafeInteger(card.totalCents)?card.totalCents:null;
  const quote=service.quantityQuote;
  if(quote?.quantity===Number(quantity)&&Number.isSafeInteger(quote.totalCents)&&
     quote.totalCents>=100)return quote.totalCents;
  // The server may limit a discount to protect supplier cost. An unsampled
  // custom amount cannot be calculated reliably from per-1K display pricing.
  // Never let an unverified customer-side estimate authorize a card charge.
  if(Array.isArray(service.quantityCards))return null;
 }
 const cents=Number(service.per1000)*Number(quantity)/10;
 return curated||service.pricingRule==="nearest"?Math.max(99,Math.round(cents)):Math.ceil(cents-1e-8);
}
export function checkoutQuantityEligible(service,quantity){
 const cents=quoteCentsForQuantity(service,quantity);
 return cents!==null&&cents>=100;
}
