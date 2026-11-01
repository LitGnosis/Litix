// Transparent, local-only TikTok engagement calculations.
// Metrics come directly from the creator, not an unauthorized TikTok scraper.
const valid=n=>Number.isFinite(n)&&Number.isSafeInteger(n)&&n>=0&&n<=1000000000000;
export function engagementSnapshot(raw){
 const fields=["views","likes","comments","shares","saves","followers"];
 const values={};
 for(const key of fields){
  const v=Number(raw?.[key]??0);
  if(!valid(v))throw new RangeError("Invalid "+key+" count");
  values[key]=v;
 }
 const interactions=values.likes+values.comments+values.shares+values.saves;
 const byViews=values.views>0?Math.round(interactions/values.views*10000)/100:null;
 const byFollowers=values.followers>0?Math.round(interactions/values.followers*10000)/100:null;
 return {...values,interactions,byViews,byFollowers,recordedAt:new Date().toISOString()};
}
export function engagementCsv(rows){
 const cols=["recordedAt","views","likes","comments","shares","saves","followers","interactions","byViews","byFollowers"];
 const quote=x=>'"'+String(x??"").replaceAll('"','""')+'"';
 return [cols.join(","),...rows.map(row=>cols.map(k=>quote(row[k])).join(","))].join("\r\n")+"\r\n";
}
