/**
 * Litix-owned 30-day original creative strategy product.
 * Deliberately different from the free seven-day planner.
 * Output is deterministic, human-editable and requires factual review;
 * it does not publish, buy engagement or claim guaranteed results.
 */
import {createHash} from "node:crypto";
import {CAPTION_PLATFORMS} from "./litixCreatorTools.mjs";
const clean=(s,n)=>String(s??"").trim().replace(/[\x00-\x1f\x7f]/g," ").replace(/\s+/g," ").slice(0,n);
const csvCell=value=>{
 let text=String(value).replace(/[\r\n]/g," ").trim();
 if(/^[=+\-@]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
};
const topics=[
 ["Brand introduction","Introduce the people behind the business","The audience should know who's speaking"],
 ["Audience pain point","Describe one audience problem without exaggerating","Name one real customer concern"],
 ["How it works","Explain your actual workflow","Show an authentic process step"],
 ["Meet the mission","Explain why your work matters","Share an original perspective"],
 ["Common question","Answer a real question about the service","Avoid unverified claims"],
 ["Quick tip","Share one applicable technique","Make it actionable"],
 ["Resource roundup","Point to useful relevant learning resources","Check external links before publication"],
 ["Seven-day recap","Summarize the week's practical takeaway","Invite voluntary feedback"],
 ["Product overview","Explain what the service includes","List real inclusions and exclusions"],
 ["Who it's for","Clarify customer eligibility","Avoid exclusionary promises"],
 ["Planning checklist","Offer three steps to prepare","Keep instructions accurate"],
 ["Behind the scenes","Show original production material","Get permission from identifiable people"],
 ["What to expect","Set realistic delivery expectations","Do not promise performance"],
 ["Frequently asked questions","Address one buying objection","Explain terms transparently"],
 ["Workflow overview","Break a project into stages","Use a truthful timeline"],
 ["Example scenario","Walk through a hypothetical use case","Label all examples as hypothetical"],
 ["Small business insight","Share a business operations lesson","Avoid unverified statistics"],
 ["Video or photo prompt","Plan an original visual demonstration","Check usage and licensing rights"],
 ["Quality standards","Explain how you check quality","Show a real standard"],
 ["Independent viewpoint","Consider a balanced alternative approach","Avoid fabricated reviews"],
 ["Terminology guide","Define a common industry term","Check factual definitions"],
 ["Audience interaction","Ask a relevant, open question","No vote or engagement exchanges"],
 ["Common mistake","Explain a preventable error","Do not disparage competitors"],
 ["Local perspective","Discuss geography-specific considerations","Verify local requirements"],
 ["Community resources","Share a publicly available educational resource","No unsolicited promotions in community groups"],
 ["Limits and trade-offs","Explain a real service limitation","Do not hide important caveats"],
 ["Customer preparation","Create a pre-purchase checklist","Never ask for account passwords"],
 ["Value demonstration","Show what a deliverable looks like","Use your own licensed sample"],
 ["Decision checklist","Give readers objective evaluation criteria","Avoid false urgency"],
 ["Monthly wrap-up","Summarize progress and a realistic next step","Review measured results before claiming success"]
];
const slug=s=>clean(s,60).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"business";
export const NATIVE_PREMIUM_PRODUCTS=Object.freeze([
 Object.freeze({id:"litix-native-30day-campaign-pro",name:"Litix 30-Day Content Campaign Kit",
  kind:"original-digital-plan",delivery:"downloadable CSV with 30 unique editorial prompts",
  publiclyPurchasable:false,requiresSettledPayment:true})
]);
export function createNativePremiumAsset({serviceId,brief}={}){
 if(serviceId!==NATIVE_PREMIUM_PRODUCTS[0].id)throw Error("NATIVE_PREMIUM_SERVICE_UNSUPPORTED");
 if(!brief||typeof brief!=="object"||Array.isArray(brief))throw Error("NATIVE_PREMIUM_BRIEF_INVALID");
 const business=clean(brief.business,80),audience=clean(brief.audience,110),
  offer=clean(brief.offer,170),action=clean(brief.action,110),platform=clean(brief.platform||"Instagram",30);
 if(business.length<2||audience.length<2||offer.length<4||action.length<3||!CAPTION_PLATFORMS.includes(platform))
  throw Error("NATIVE_PREMIUM_BRIEF_INVALID");
 let baseUrl=null;
 if(brief.website){
  try{
   const u=new URL(clean(brief.website,300));
   if(u.protocol!=="https:"||u.username||u.password||u.port||!u.hostname.includes(".")||
     /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(u.hostname))throw Error();
   baseUrl=u;
  }catch{throw Error("NATIVE_PREMIUM_DESTINATION_INVALID");}
 }
 const header=["Day","Channel","Topic","Content angle","Draft caption","Call to action","Tracking URL","Production and disclosure note"];
 const rows=topics.map(([topic,angle,note],i)=>{
  const caption=business+" helps "+audience+" with "+offer+". Today's focus: "+angle+
   ". Learn more about the actual options, limitations and next steps.";
  let url="";
  if(baseUrl){
   const u=new URL(baseUrl.toString());
   u.searchParams.set("utm_source",platform.toLowerCase());
   u.searchParams.set("utm_medium","organic_social");
   u.searchParams.set("utm_campaign","litix_pro30_"+slug(business));
   u.searchParams.set("utm_content","day_"+(i+1));url=u.toString();
  }
  return [i+1,platform,topic,angle,caption,action,url,note];
 });
 const content=[header,...rows].map(r=>r.map(csvCell).join(",")).join("\r\n")+"\r\n";
 const filename=slug(business)+"-30day-campaign-pro.csv";
 return Object.freeze({serviceId,filename,mimeType:"text/csv; charset=utf-8",
  content,sha256:createHash("sha256").update(content).digest("hex"),
  publiclyPurchasable:false,deliveryState:"UNPAID_PREPARED_NOT_DELIVERED",
  rows:rows.length});
}
