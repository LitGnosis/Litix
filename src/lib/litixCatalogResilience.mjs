// Bounded stale-while-revalidate for PUBLIC CATALOG READS ONLY.
// This cache is not a checkout or supplier-order authorization source.
export function createResilientCatalogCache({
 fetchFresh,clock=()=>Date.now(),freshMs=90_000,staleMs=15*60_000
}={}){
 if(typeof fetchFresh!=="function")throw Error("catalog_fetcher_required");
 let last=null,updated=0,inflight=null;
 const age=()=>clock()-updated;
 const usable=()=>last!==null&&age()>=0&&age()<staleMs;
 const read=async()=>{
  if(last!==null&&age()>=0&&age()<freshMs)return {items:last,status:"live"};
  if(!inflight){
   inflight=Promise.resolve().then(fetchFresh).then(items=>{
    if(!Array.isArray(items)||!items.length)throw Error("catalog_empty_or_invalid");
    last=items;updated=clock();return {items:last,status:"live"};
   }).catch(error=>{
    if(usable())return {items:last,status:"cached"};
    throw error;
   }).finally(()=>{inflight=null});
  }
  // Serve a prior read while revalidation is in flight; never serve >15m old.
  if(usable()){
   inflight.catch(()=>{});
   return {items:last,status:"cached"};
  }
  return inflight;
 };
 return {read};
}
