// Privacy-first Litix Growth OS calendar utilities. No network calls or supplier/payment access.
export const CALENDAR_PLATFORMS=Object.freeze(["Instagram","TikTok","YouTube","Facebook","LinkedIn","Other"]);
export const CALENDAR_STATUSES=Object.freeze(["Draft","Planned","Published"]);
export const CALENDAR_MAX_ENTRIES=200;
export const CALENDAR_STORAGE_KEY="litix:growth-calendar:v1";

export function validCalendarDate(input){
  if(typeof input!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(input))return false;
  const [y,m,d]=input.split("-").map(Number);
  if(y<2000||y>2100||m<1||m>12||d<1||d>31)return false;
  const date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
export function validateCalendarDraft(raw){
  if(!raw||typeof raw!=="object")return {ok:false,error:"Enter a valid campaign item."};
  const title=String(raw.title||"").trim().slice(0,100);
  const note=String(raw.note||"").trim().slice(0,2000);
  const date=String(raw.date||"");
  const platform=String(raw.platform||"");
  const status=String(raw.status||"");
  if(!title)return {ok:false,error:"Content title is required."};
  if(!validCalendarDate(date))return {ok:false,error:"Choose a real calendar date."};
  if(!CALENDAR_PLATFORMS.includes(platform))return {ok:false,error:"Choose a supported platform label."};
  if(!CALENDAR_STATUSES.includes(status))return {ok:false,error:"Choose a valid status."};
  return {ok:true,value:{title,note,date,platform,status}};
}
export function restoreCalendarEntries(input){
  let rows;
  try{rows=typeof input==="string"?JSON.parse(input):input;}catch{return []}
  if(!Array.isArray(rows))return [];
  const found=new Set();
  return rows.slice(0,CALENDAR_MAX_ENTRIES*2).flatMap(row=>{
    if(!row||typeof row!=="object"||typeof row.id!=="string"||!/^[-\w]{8,80}$/.test(row.id)||found.has(row.id))return [];
    const d=validateCalendarDraft(row);
    if(!d.ok)return [];
    found.add(row.id);
    return [{id:row.id,...d.value}];
  }).slice(0,CALENDAR_MAX_ENTRIES);
}
export function monthGrid(year,monthZeroBased){
  if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(monthZeroBased)||monthZeroBased<0||monthZeroBased>11)return [];
  const first=new Date(year,monthZeroBased,1).getDay();
  const last=new Date(year,monthZeroBased+1,0).getDate();
  return [...Array(Math.ceil((first+last)/7)*7)].map((_,i)=>{
    const day=i-first+1;
    return day>=1&&day<=last?`${year}-${String(monthZeroBased+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`:null;
  });
}
function safeCsvCell(input){
  const s=String(input??"").replace(/[\r\n]+/g," ").slice(0,2100);
  // Spreadsheet formula injection can start even with leading whitespace.
  const safe=/^[\s\u0000-\u001f]*[=+@\-]/u.test(s)?"'"+s:s;
  return '"'+safe.replace(/"/g,'""')+'"';
}
export function calendarCsv(items){
  const columns=["Date","Platform","Title","Status","Notes"];
  const rows=restoreCalendarEntries(items).sort((a,b)=>a.date.localeCompare(b.date));
  return "\uFEFF"+columns.join(",")+"\r\n"+rows.map(e=>[e.date,e.platform,e.title,e.status,e.note].map(safeCsvCell).join(",")).join("\r\n")+"\r\n";
}
