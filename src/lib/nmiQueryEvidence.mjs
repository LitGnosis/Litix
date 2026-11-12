// NMI Classic Query API returns XML. Extract only selected billing-evidence fields.
// Raw reports may contain personal or card information: never log or persist raw XML.
const tag=(xml,name)=>{
 const safe=String(name).replace(/[^a-z_]/g,"");
 const m=String(xml).match(new RegExp("<"+safe+">(.*?)</"+safe+">","is"));
 return m?m[1].trim():"";
};
export function parseNmiUtc(value) {
 if(!/^\d{14}$/.test(String(value||"")))return null;
 const v=String(value);
 const iso=v.slice(0,4)+"-"+v.slice(4,6)+"-"+v.slice(6,8)+"T"+v.slice(8,10)+":"+v.slice(10,12)+":"+v.slice(12,14)+"Z";
 const date=new Date(iso);
 return Number.isNaN(date.getTime())||date.toISOString().slice(0,19)!==iso.slice(0,19)?null:date;
}
export function parseNmiTransactionEvidence(xml,subscriptionId,monthlyCents) {
 if(typeof xml!=="string"||xml.length>500_000||!xml.includes("<nm_response"))throw Error("Invalid NMI report");
 const found=[];
 for(const match of xml.matchAll(/<transaction(?:\s[^>]*)?>([\s\S]*?)<\/transaction>/gi)){
  const row=match[1];
  const txn=tag(row,"transaction_id"),sid=tag(row,"subscription_id");
  if(!/^\d{1,30}$/.test(txn)||sid!==String(subscriptionId)||tag(row,"condition")!=="complete")continue;
  if(!Array.from(row.matchAll(/<action(?:\s[^>]*)?>([\s\S]*?)<\/action>/gi)).some(a=>{
   const action=a[1];
   if(tag(action,"source")!=="recurring"||tag(action,"action_type")!=="sale"||tag(action,"success")!=="1")return false;
   const amount=tag(action,"amount");
   if(!/^[0-9]{1,8}\.[0-9]{2}$/.test(amount))return false;
   const [whole,fraction]=amount.split(".");
   return Number(whole)*100+Number(fraction)===monthlyCents;
  }))continue;
  const sale=Array.from(row.matchAll(/<action(?:\s[^>]*)?>([\s\S]*?)<\/action>/gi))
   .find(a=>tag(a[1],"source")==="recurring"&&tag(a[1],"action_type")==="sale"&&tag(a[1],"success")==="1");
  const when=parseNmiUtc(tag(sale?.[1]||"","date"));
  if(!when)continue;
  found.push({transactionId:txn,subscriptionId:sid,paidAt:when.toISOString()});
 }
 return found;
}
export function paidPeriodEnd(iso){
 const d=new Date(iso);
 if(Number.isNaN(d.getTime()))throw Error("Invalid payment date");
 const n=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+2,0,d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()));
 const limit=n.getUTCDate(), day=Math.min(d.getUTCDate(),limit);
 return new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),day,d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds())).toISOString();
}
