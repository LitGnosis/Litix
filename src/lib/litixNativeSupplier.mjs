/**
 * First-party Litix digital-asset supplier, PHASE 1 (internal-only).
 *
 * No networking, database, payment, email, social-account or third-party
 * supplier side effects. No payment is authorized and no order is fulfilled.
 * An approved server-side paid-order adapter must separately verify settlement,
 * atomically claim the work and deliver the asset.
 * This module must never be used to create or sell artificial engagement.
 */
import {createHash} from "node:crypto";
import {buildCaptionIdeas,linkPageExport,CAPTION_TONES,CAPTION_PLATFORMS} from "./litixCreatorTools.mjs";
import {campaignPlanCsv} from "./litixNativeCampaign.mjs";

const INVENTORY=Object.freeze([
 Object.freeze({id:"litix-native-caption-kit",name:"Litix Caption Starter Kit",kind:"owned-digital-asset",type:"caption-pack",quantity:1,status:"INTERNAL_QA_ONLY",publiclyPurchasable:false}),
 Object.freeze({id:"litix-native-link-page",name:"Litix Exportable Link Page",kind:"owned-digital-asset",type:"link-page",quantity:1,status:"INTERNAL_QA_ONLY",publiclyPurchasable:false}),
 Object.freeze({id:"litix-native-campaign-plan",name:"Litix 7-Day Campaign Planner",kind:"owned-digital-asset",type:"campaign-plan",quantity:1,status:"INTERNAL_QA_ONLY",publiclyPurchasable:false})
]);
export function litixNativeServices(){return INVENTORY;}
export function litixNativeService(id){return INVENTORY.find(s=>s.id===id)||null;}
const hash=s=>createHash("sha256").update(s,"utf8").digest("hex");
const safeName=name=>String(name||"litix").trim().replace(/[^a-z0-9-]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,48).toLowerCase()||"litix";

/**
 * Build a first-party asset in memory. It is NOT purchased or sent.
 * previewHash deduplicates local previews, not real supplier orders.
 */
export function previewLitixNativeAsset({serviceId,brief}={}){
 const service=litixNativeService(serviceId);
 if(!service)throw Error("NATIVE_SERVICE_NOT_SUPPORTED");
 if(!brief||typeof brief!=="object"||Array.isArray(brief))throw Error("NATIVE_BRIEF_INVALID");
 let content,filename,mimeType;
 if(service.type==="caption-pack"){
  const platform=String(brief.platform||"Instagram");
  if(!CAPTION_PLATFORMS.includes(platform))throw Error("NATIVE_PLATFORM_INVALID");
  const shared={business:brief.business,audience:brief.audience,offer:brief.offer,action:brief.action,platform};
  const clear=buildCaptionIdeas({...shared,tone:"Clear"});
  const announcements=CAPTION_TONES.map(tone=>({label:tone+" announcement",text:buildCaptionIdeas({...shared,tone})[2].text}));
  content=["Litix original caption starter kit | "+platform,
   "Review each draft for factual accuracy, rights and platform rules before posting.","",
   ...[clear[0],clear[1],...announcements].flatMap((entry,i)=>[(i+1)+". "+entry.label,entry.text,""])].join("\n");
  filename=safeName(brief.business)+"-captions.txt";
  mimeType="text/plain; charset=utf-8";
 }else if(service.type==="campaign-plan"){
  content=campaignPlanCsv(brief);
  filename=safeName(brief.business)+"-campaign-7days.csv";
  mimeType="text/csv; charset=utf-8";
 }else if(service.type==="link-page"){
  content=linkPageExport({name:brief.name,tagline:brief.tagline,links:brief.links});
  filename=safeName(brief.name)+"-links.html";
  mimeType="text/html; charset=utf-8";
 }else throw Error("NATIVE_DELIVERY_NOT_SUPPORTED");
 const checksum=hash(content);
 return Object.freeze({serviceId,filename,mimeType,content,sha256:checksum,
  previewHash:hash(serviceId+"\n"+checksum),
  deliveryState:"PREVIEW_ONLY_NOT_PURCHASED",publiclyPurchasable:false});
}
