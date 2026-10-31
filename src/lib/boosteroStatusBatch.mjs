// Read-only Boostero API utilities: these functions never place supplier orders.
export function boosteroBatchIds(value){
 const raw=Array.isArray(value)?value:String(value??"").split(",");
 if(raw.length<1||raw.length>100)throw Error("boostero_batch_size_invalid");
 const ids=raw.map(x=>String(x??"").trim());
 if(ids.some(x=>!/^\d{1,24}$/.test(x))||new Set(ids).size!==ids.length)
  throw Error("boostero_batch_ids_invalid");
 return ids;
}
const known=new Set(["pending","processing","in progress","in_progress","completed","complete",
 "partial","canceled","cancelled","failed","error","refilling"]);
export function normalizeBoosteroStatus(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||raw.error)return null;
 const status=String(raw.status||"").trim().slice(0,80);
 if(!known.has(status.toLowerCase()))return null;
 let remains=null;
 if(raw.remains!==null&&raw.remains!==undefined&&raw.remains!==""){
  const parsed=Number(raw.remains);
  if(!Number.isSafeInteger(parsed)||parsed<0)return null;
  remains=parsed;
 }
 return {status,remains};
}
export function boosteroChildState(status){
 const s=String(status||"").trim().toLowerCase();
 if(s==="completed"||s==="complete")return "COMPLETED";
 if(["canceled","cancelled","failed","error","partial"].includes(s))return "MANUAL_REVIEW";
 return "SUBMITTED";
}
export function boosteroSupplierDelivered(quantity,remains){
 const total=Number(quantity),left=Number(remains);
 return Number.isSafeInteger(total)&&total>=0&&remains!==null&&remains!==undefined&&
  Number.isSafeInteger(left)&&left>=0&&left<=total?total-left:null;
}
