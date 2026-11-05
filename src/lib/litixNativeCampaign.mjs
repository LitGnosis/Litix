/**
 * Original, deterministic 7-day campaign plan. Built and delivered entirely by
 * Litix. Does not post, purchase views, claim reach, or contact any suppliers.
 */
import {CAPTION_PLATFORMS} from "./litixCreatorTools.mjs";
const clean=(v,max)=>typeof v==="string"?v.trim().replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").slice(0,max):"";
const slug=s=>clean(s,80).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"litix";
const asCsv=s=>{
 let v=String(s??"").replace(/[\x00-\x1f\x7f]/g," ");
 if(/^[ \t]*[=+\-@]/.test(v))v="'"+v;
 return '"'+v.replace(/"/g,'""')+'"';
};
export function campaignPlanCsv(raw){
 const business=clean(raw?.business,80),audience=clean(raw?.audience,110),
  offer=clean(raw?.offer,170),action=clean(raw?.action,110),
  platform=clean(raw?.platform||"Instagram",30);
 if(business.length<2||audience.length<2||offer.length<4||action.length<3||
    !CAPTION_PLATFORMS.includes(platform))throw Error("NATIVE_CAMPAIGN_BRIEF_INVALID");
 const website=clean(raw?.website,300);
 let destination="";
 if(website){
  let u;try{u=new URL(website);}catch{throw Error("NATIVE_CAMPAIGN_URL_INVALID");}
  if(u.protocol!=="https:"||u.username||u.password||u.port||!u.hostname.includes(".")||
    /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(u.hostname)||
    u.hostname.length>200||u.href.length>350)throw Error("NATIVE_CAMPAIGN_URL_INVALID");
  destination=u.href;
 }
 const dayTemplates=[
  {theme:"Introduction",hook:"Meet "+business,caption:"We're "+business+". We help "+audience+" explore "+offer+".",task:"Use an original photo or video introducing the business."},
  {theme:"Problem and solution",hook:"What challenge matters most?",caption:"For "+audience+", choosing where to start can be hard. Here's how we approach "+offer+".",task:"Share a truthful, specific example without promising outcomes."},
  {theme:"Behind the scenes",hook:"A look behind the work",caption:"Here's a closer look at how "+business+" works on "+offer+".",task:"Show only original or licensed behind-the-scenes material."},
  {theme:"Education",hook:"One practical idea",caption:"A useful tip for "+audience+": start with one clear goal before exploring "+offer+".",task:"Share a genuinely useful explanation, not a fabricated result."},
  {theme:"Questions",hook:"Your opinion matters",caption:"What is one question you have about "+offer+"? We'd like to learn what matters to "+audience+".",task:"Invite voluntary feedback; no paid or incentivized engagement."},
  {theme:"Offer details",hook:"Explore the details",caption:"Curious about "+offer+"? "+business+" can help you understand what's involved.",task:"Explain actual eligibility, terms, pricing and limits accurately."},
  {theme:"Recap and next step",hook:"Ready for your next step?",caption:"This week we've explored "+offer+" with "+audience+". Here's where to learn more.",task:"Review your campaign metrics and adjust the next week's content."}
 ];
 const header=["Day","Platform","Theme","Hook","Caption","CTA","Tagged landing page","Production reminder"];
 const rows=dayTemplates.map((entry,i)=>{
  let url="";
  if(destination){
   const u=new URL(destination);u.searchParams.set("utm_source",platform.toLowerCase());
   u.searchParams.set("utm_medium","organic_social");u.searchParams.set("utm_campaign","litix_"+slug(business)+"_7day");
   u.searchParams.set("utm_content","day_"+(i+1));url=u.toString();
  }
  return [i+1,platform,entry.theme,entry.hook,entry.caption,action,url,entry.task];
 });
 return [header,...rows].map(row=>row.map(asCsv).join(",")).join("\r\n")+"\r\n";
}
