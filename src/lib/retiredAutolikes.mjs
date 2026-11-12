// The Boostero live shop never sells unverified AutoLikes or future-post plans.
export function retiredAutoLikesService(service){
 const label=[service?.name,service?.category,service?.type].map(v=>String(v||"")).join(" ");
 return /\bauto[\s_-]*likes?\b|\bautomatic\s+likes?\b|\bauto[\s_-]*views?\b|\bfuture\s+posts?\b|\bpost\s+detector\b|\bsubscription\b/i.test(label);
}
