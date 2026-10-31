// Pure, no-network progress milestones for one payment split across 2–5 posts.
// Supplier-reported "remains" is not an independently verified social count.
export function multiPostMilestone(children){
 if(!Array.isArray(children)||children.length<2||children.length>5)return null;
 let total=0,remaining=0,allKnown=true,active=false,review=false,complete=true;
 for(const p of children){
  const qty=Number(p?.quantity);
  if(!Number.isSafeInteger(qty)||qty<1)return null;
  const state=String(p.state||"").toUpperCase();
  const status=String(p.supplier_status?.status||"").toLowerCase();
  if(state==="MANUAL_REVIEW"||state==="UNKNOWN_OUTCOME")review=true;
  if(state!=="COMPLETED")complete=false;
  if(["in progress","in_progress","processing","partial","completed","complete"].includes(status)||state==="COMPLETED")active=true;
  const raw=p.supplier_status?.remains;
  const rem=raw===null||raw===undefined||String(raw).trim()===""?null:Number(raw);
  if(!Number.isSafeInteger(rem)||rem<0||rem>qty)allKnown=false;
  else remaining+=rem;
  total+=qty;
 }
 if(review)return {phase:"needs_support",label:"Delivery needs support",remaining:allKnown?remaining:null,total};
 if(complete)return {phase:"complete",label:"Delivery completed",remaining:allKnown?remaining:null,total};
 if(!active)return null;
 // Email at most on start and each 25% milestone. Supplier updates between
 // milestones change the tracking page but do not spam the customer.
 const delivered=allKnown?total-remaining:null;
 const quarter=delivered===null?0:Math.min(3,Math.floor(4*delivered/total));
 return {phase:quarter?String(quarter*25):"started",label:quarter?"Delivery progressing":"Delivery in progress",
  remaining:allKnown?remaining:null,total};
}
