/**
 * Litix Analytics Studio — user-entered campaign snapshots.
 * No scraping, no platform OAuth, no paid supplier performance attribution.
 * Private local browser storage only. No network requests or account claims.
 */
export const ANALYTICS_STORE_KEY="litix:analytics-studio:v1";
export const ANALYTICS_PLATFORMS=Object.freeze(["Instagram","TikTok","YouTube","Facebook","X","LinkedIn","Spotify","Website","Other"]);
export const ANALYTICS_METRICS=Object.freeze(["followers","impressions","views","likes","comments","shares","clicks","leads","spendCents"]);
export const MAX_CAMPAIGNS=30,MAX_SNAPSHOTS=180;
const validDate=v=>typeof v==="string"&&/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(v)&&
 !Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v;
const count=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0&&Number(v)<=1_000_000_000?Number(v):null;
const money=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0&&Number(v)<=10_000_000_00?Number(v):null;
const idValid=v=>typeof v==="string"&&/^[a-zA-Z0-9_-]{8,60}$/.test(v);
const trim=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
export function validateAnalyticsCampaign(input){
 const name=trim(input?.name,100),platform=trim(input?.platform,32),goal=trim(input?.goal,130);
 const website=trim(input?.website,230);
 if(name.length<3)return {ok:false,error:"Campaign name needs at least 3 characters."};
 if(!ANALYTICS_PLATFORMS.includes(platform))return {ok:false,error:"Choose an available platform."};
 if(goal.length>0&&goal.length<3)return {ok:false,error:"Enter a meaningful goal or leave it blank."};
 if(website){
  try{const url=new URL(website);if(url.protocol!=="https:"||url.username||url.password||url.port||url.hash||
    /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(url.hostname)||
    !url.hostname.includes("."))return {ok:false,error:"Website must be a public HTTPS link."}}
  catch{return {ok:false,error:"Enter a valid HTTPS URL or leave it blank."}}
 }
 return {ok:true,value:{name,platform,goal,website,source:"user_entered",verifiedExternalMetrics:false}};
}
export function validateAnalyticsSnapshot(input){
 const date=trim(input?.date,12);
 if(!validDate(date))return {ok:false,error:"Enter a real date in YYYY-MM-DD format."};
 const value={date,source:"user_entered",verifiedExternalMetrics:false};
 for(const field of ANALYTICS_METRICS){
  const raw=input?.[field]??0;
  const n=field==="spendCents"?money(raw):count(raw);
  if(n===null)return {ok:false,error:"Invalid non-negative "+field+" value."};
  value[field]=n;
 }
 if(value.clicks>value.impressions&&value.impressions>0)
  return {ok:false,error:"Clicks cannot exceed recorded impressions."};
 if(value.leads>value.clicks&&value.clicks>0)
  return {ok:false,error:"Leads cannot exceed recorded clicks."};
 return {ok:true,value};
}
function canonicalCampaign(candidate){
 if(!candidate||!idValid(candidate.id))return null;
 const checked=validateAnalyticsCampaign(candidate);
 if(!checked.ok)return null;
 const snapshots=[];
 for(const s of Array.isArray(candidate.snapshots)?candidate.snapshots.slice(0,MAX_SNAPSHOTS):[]){
  const validated=validateAnalyticsSnapshot(s);
  if(validated.ok)snapshots.push(validated.value);
 }
 const byDate=new Map(snapshots.map(s=>[s.date,s]));
 return {id:candidate.id,...checked.value,createdAt:validDate(candidate.createdAt)?candidate.createdAt:"2026-01-01",
  snapshots:[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-MAX_SNAPSHOTS)};
}
export function restoreAnalytics(raw){
 if(typeof raw!=="string"||raw.length>2_000_000)return [];
 let data;try{data=JSON.parse(raw)}catch{return []}
 if(!Array.isArray(data))return [];
 return data.slice(0,MAX_CAMPAIGNS).map(canonicalCampaign).filter(Boolean);
}
export function upsertAnalyticsCampaign(campaigns,candidate){
 const c=canonicalCampaign(candidate);
 if(!c)throw Error("invalid_campaign");
 const list=(Array.isArray(campaigns)?campaigns:[]).filter(x=>x.id!==c.id);
 if(list.length>=MAX_CAMPAIGNS)throw Error("campaign_limit_reached");
 return [c,...list].slice(0,MAX_CAMPAIGNS);
}
export function addAnalyticsSnapshot(campaign,snapshot){
 const valid=validateAnalyticsSnapshot(snapshot);
 if(!valid.ok)throw Error(valid.error);
 const current=canonicalCampaign(campaign);
 if(!current)throw Error("invalid_campaign");
 return {...current,snapshots:[...current.snapshots.filter(x=>x.date!==valid.value.date),valid.value]
  .sort((a,b)=>a.date.localeCompare(b.date)).slice(-MAX_SNAPSHOTS)};
}
const pct=(n,d)=>d>0?Math.round(n/d*10000)/100:null;
const metric=(v)=>Math.round(v*100)/100;
export function analyticsSummary(campaign){
 const snapshots=canonicalCampaign(campaign)?.snapshots||[];
 if(!snapshots.length)return {hasData:false,snapshotCount:0,source:"user_entered",externallyVerified:false};
 const first=snapshots[0],last=snapshots.at(-1);
 // Snapshots are cumulative dashboard totals, NOT additive daily metrics.
 const sum=Object.fromEntries(ANALYTICS_METRICS.map(k=>[k,last[k]]));
 const followerDelta=last.followers-first.followers;
 return {hasData:true,snapshotCount:snapshots.length,
  firstDate:first.date,lastDate:last.date,source:"user_entered",externallyVerified:false,
  ...sum,followerDelta,followersChangePercent:pct(followerDelta,first.followers),
  engagementPercent:pct(last.likes+last.comments+last.shares,last.impressions),
  clickThroughPercent:pct(last.clicks,last.impressions),
  leadConversionPercent:pct(last.leads,last.clicks),
  costPerLeadUsd:last.leads>0?metric(last.spendCents/100/last.leads):null,
  costPerThousandImpressionsUsd:last.impressions>0?metric(last.spendCents/100*1000/last.impressions):null,
  trend:snapshots.map(s=>({date:s.date,followers:s.followers,impressions:s.impressions,clicks:s.clicks,leads:s.leads}))
 };
}
const csv=(v)=>{let s=String(v??"");if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
export function analyticsCsv(campaigns){
 const rows=[["Campaign","Platform","Goal","Date",...ANALYTICS_METRICS,"Source","Verified"]];
 for(const c of Array.isArray(campaigns)?campaigns:[]){
  const campaign=canonicalCampaign(c);if(!campaign)continue;
  for(const s of campaign.snapshots)
   rows.push([campaign.name,campaign.platform,campaign.goal,s.date,...ANALYTICS_METRICS.map(k=>s[k]),"User entered","No"]);
 }
 return "\uFEFF"+rows.map(row=>row.map(csv).join(",")).join("\r\n")+"\r\n";
}
