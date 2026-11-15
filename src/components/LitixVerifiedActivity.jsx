"use client";

import {useEffect,useState} from "react";

export default function LitixVerifiedActivity(){
 const [count,setCount]=useState(null);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/public-activity",{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    if(!response.ok)return null;
    return response.json();
   })
   .then(data=>{
    const n=Number(data?.verifiedDispatchedOrders24h);
    if(data?.available===true&&Number.isSafeInteger(n)&&n>=5)
     setCount(n);
   }).catch(()=>{});
  return ()=>controller.abort();
 },[]);
 if(count===null)return null;
 return <p className="litix-verified-activity" role="status">
  <span aria-hidden="true">✓</span>
  {count.toLocaleString("en-US")} confirmed Litix order{count===1?"":"s"} submitted to fulfillment in the past 24 hours
 </p>;
}
