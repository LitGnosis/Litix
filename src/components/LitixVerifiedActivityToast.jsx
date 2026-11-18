"use client";
import {useEffect,useState} from "react";
// No fictional cities, testimonials or fabricated timestamps: all data comes
// from the existing paid-and-dispatched order ledger aggregate.
export default function LitixVerifiedActivityToast(){
 const [count,setCount]=useState(null),[dismissed,setDismissed]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/public-activity",{cache:"no-store",signal:controller.signal})
   .then(r=>r.ok?r.json():null)
   .then(x=>{if(x?.available===true&&Number.isSafeInteger(x.verifiedDispatchedOrders24h)&&x.verifiedDispatchedOrders24h>=5)
      setCount(x.verifiedDispatchedOrders24h);})
   .catch(()=>{});
  return()=>controller.abort();
 },[]);
 if(count===null||dismissed)return null;
 return <aside className="litix-activity-toast" aria-label="Verified recent order activity">
  <span aria-hidden="true">●</span>
  <p><strong>Litix activity</strong> {count.toLocaleString("en-US")} paid orders submitted to fulfillment in the past 24 hours.</p>
  <button type="button" aria-label="Dismiss order activity" onClick={()=>setDismissed(true)}>×</button>
 </aside>;
}
