// Litix-owned, deterministic campaign-planning technology.
// This prepares creative briefs and traceable links; it does not impersonate
// third-party publishers, publish posts, or represent paid orders as fulfilled.
export const GROWTH_CHANNELS=Object.freeze([
 Object.freeze({id:"instagram",label:"Instagram Reels",tag:"#Marketing #SmallBusiness"}),
 Object.freeze({id:"tiktok",label:"TikTok",tag:"#SmallBusiness #ContentMarketing"}),
 Object.freeze({id:"youtube",label:"YouTube Shorts",tag:"#Shorts #Marketing"}),
 Object.freeze({id:"linkedin",label:"LinkedIn",tag:"#BusinessGrowth #MarketingOperations"})
]);
const clean=(value,max)=>typeof value==="string"?value.trim().replace(/\s+/g," ").slice(0,max):"";
const slug=value=>clean(value,100).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,64);
export function safeCampaignUrl(input){
 try{
  const u=new URL(String(input||"").trim());
  if(u.protocol!=="https:"||u.username||u.password||!u.hostname.includes(".")||
    /(^|\.)(localhost|local|internal)$/.test(u.hostname.toLowerCase())||
    /^(127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname))return null;
  return u;
 }catch{return null}
}
export function trackedCampaignUrl(base,channel,campaign,angle){
 const u=safeCampaignUrl(base);
 if(!u||!GROWTH_CHANNELS.some(c=>c.id===channel)||!["problem","process","questions"].includes(angle))
  throw Error("A valid HTTPS landing page and channel are required.");
 const tag=slug(campaign);
 if(!tag)throw Error("The campaign must have a name.");
 u.searchParams.set("utm_source",channel);
 u.searchParams.set("utm_medium","organic_social");
 u.searchParams.set("utm_campaign",tag);
 u.searchParams.set("utm_content",angle);
 return u.toString();
}
function anglesFor({audience,pain,solution,proof,cta}){
 return [
  {id:"problem",name:"Problem-first",
   hook:"Still losing time to "+pain+"?",
   story:"For "+audience+", start with the actual obstacle: "+pain+". Then consider: "+solution+".",
   visual:"0–3 sec: state the pain. 3–15 sec: demonstrate a useful first step. 15–25 sec: show the offer and next action.",
   cta},
  {id:"process",name:"Show the process",
   hook:"Here is a simpler way to approach "+pain+".",
   story:"Step 1: identify the goal. Step 2: document the current workflow. Step 3: evaluate "+solution+".",
   visual:"0–3 sec: introduce the workflow. 3–15 sec: show three steps on screen. 15–25 sec: invite a relevant inquiry.",
   cta},
  {id:"questions",name:"Buyer questions",
   hook:"Three questions to ask before spending on "+solution+".",
   story:"What will actually be delivered? Who is responsible for it? How will you measure the result?"+(proof?" Evidence available for review: "+proof+".":""),
   visual:"0–3 sec: open with a buying question. 3–15 sec: display the three questions. 15–25 sec: show where to inquire.",
   cta}
 ];
}
export function buildNativeGrowthKit(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Please complete a campaign brief.");
 const brand=clean(raw.brand,70),audience=clean(raw.audience,120),
  pain=clean(raw.pain,140),solution=clean(raw.solution,180),cta=clean(raw.cta,80),
  proof=clean(raw.proof,180),campaign=slug(raw.campaign||brand);
 const page=safeCampaignUrl(raw.landingUrl);
 if(brand.length<2||audience.length<3||pain.length<8||solution.length<8||cta.length<3||!campaign||!page)
  throw Error("Add a business, audience, problem, solution, call to action and valid HTTPS landing link.");
 const angles=anglesFor({brand,audience,pain,solution,cta,proof});
 const variants=GROWTH_CHANNELS.flatMap(channel=>angles.map(angle=>{
  const trackedUrl=trackedCampaignUrl(page.toString(),channel.id,campaign,angle.id);
  let caption="";
  if(channel.id==="youtube")caption=angle.hook+"\n"+angle.story+"\n"+cta+": "+trackedUrl+"\n"+channel.tag;
  else if(channel.id==="linkedin")caption=brand+" | "+angle.hook+"\n\n"+angle.story+"\n\n"+cta+": "+trackedUrl+"\n"+channel.tag;
  else caption=angle.hook+"\n"+angle.story+"\n"+cta+": "+trackedUrl+"\n"+channel.tag;
  return Object.freeze({
   id:channel.id+"-"+angle.id,platform:channel.id,channel:channel.label,
   angle:angle.id,angleName:angle.name,hook:angle.hook,
   caption:caption.slice(0,2200),shotList:angle.visual,
   trackingUrl:trackedUrl,status:"DRAFT — HUMAN REVIEW REQUIRED",
   published:false,videoRendered:false
  });
 }));
 return Object.freeze({brand,campaign,source:"OWNER-PROVIDED CAMPAIGN BRIEF",variants,
   disclosure:"Planning drafts only. No video was edited, account was connected, post was published, lead was generated or service was fulfilled."});
}
export function weeklySalesRunRate({weeklyGoal=10000,monthlyRetainer=4000,closeRate=20}={}){
 const target=Number(weeklyGoal),retainer=Number(monthlyRetainer),rate=Number(closeRate);
 if(!Number.isFinite(target)||!Number.isFinite(retainer)||!Number.isFinite(rate)||
  target<=0||retainer<=0||rate<=0||rate>100)throw Error("Enter positive targets and a close rate between 1% and 100%.");
 const monthlyTarget=target*52/12;
 const retainedClients=Math.ceil(monthlyTarget/retainer);
 return Object.freeze({
  monthlyTarget:Math.ceil(monthlyTarget),
  clientsNeeded:retainedClients,
  qualifiedSalesCalls:Math.ceil(retainedClients/(rate/100)),
  monthlyGross:retainedClients*retainer,
  weeklyGrossRunRate:retainedClients*retainer*12/52,
  profitVerified:false,
  note:"Forecast only. Assumes every client remains active and pays the full monthly fee; excludes costs, refunds, taxes and delivery capacity."
 });
}
