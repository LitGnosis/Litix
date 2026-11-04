// Fail-closed SMMXPERT service classification.
// Some provider categories disagree with their own service names; accepting
// those as customer-facing Followers when they are actually Likes is unsafe.
const platformWords=[
 ["Instagram",/(?:\binstagram\b|\big\b)/i],
 ["TikTok",/\btik[\s._-]*tok\b/i],
 ["YouTube",/\byoutube\b/i],
 ["Twitter (X)",/(?:\btwitter\b|\bx\s+(?:likes|views|followers|retweets)\b)/i]
];
const kindWords=[
 ["followers",/\bfollowers?\b/i],
 ["likes",/\blikes?\b/i],
 ["views",/\bviews?\b/i],
 ["subscribers",/\bsubscribers?\b/i],
 ["retweets",/\b(?:retweets?|reposts?)\b/i]
];
function uniqueMatch(text,rules){
 const hits=rules.filter(([,rx])=>rx.test(text)).map(([name])=>name);
 return hits.length===1?hits[0]:null;
}
export function classifySmmxpertService(item){
 const name=String(item?.name||"").slice(0,220);
 const category=String(item?.category||"").slice(0,160);
 const np=uniqueMatch(name,platformWords),cp=uniqueMatch(category,platformWords);
 const nk=uniqueMatch(name,kindWords),ck=uniqueMatch(category,kindWords);
 const reason=!np?"name_platform_unknown":
  !nk?"name_kind_unknown":
  cp&&cp!==np?"category_platform_conflict":
  ck&&ck!==nk?"category_kind_conflict":null;
 if(reason)return {eligible:false,reason,platform:null,kind:null};
 return {eligible:true,platform:np,kind:nk,reason:null,
  usa:/\b(?:usa|american|united states|us only)\b/i.test(name+" "+category),
  refill:item?.refill===true, // marketing claims are not refill API guarantees
  cancel:item?.cancel===true};
}
export function listEligibleSmmxpertDefaults(items){
 if(!Array.isArray(items))throw Error("smmxpert_catalog_not_array");
 const approved=[],rejected={};
 for(const item of items){
  const c=classifySmmxpertService(item);
  const type=String(item?.serviceType??item?.type??"").toLowerCase();
  const id=String(item?.id??item?.service??"");
  const min=Number(item?.min),max=Number(item?.max),rate=Number(item?.retailIndependentRate??item?.rate);
  if(!c.eligible){rejected[c.reason]=(rejected[c.reason]||0)+1;continue}
  if(type!=="default"||!/^[1-9][0-9]{0,17}$/.test(id)||
     !Number.isSafeInteger(min)||min<1||!Number.isSafeInteger(max)||max<min||
     !Number.isFinite(rate)||rate<=0){
    rejected.invalid_supplier_spec=(rejected.invalid_supplier_spec||0)+1;continue;
  }
  if(min>1_000_000){rejected.quantity_outside_limits=(rejected.quantity_outside_limits||0)+1;continue}
  approved.push({
   id,name:String(item.name||"").slice(0,180),category:String(item.category||"").slice(0,140),
   platform:c.platform,kind:c.kind,usa:c.usa,
   min,max:Math.min(1_000_000,max),rate,
   apiRefillEligible:c.refill,apiCancelEligible:c.cancel
  });
 }
 return {eligible:approved,rejected};
}
