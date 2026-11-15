"use client";
import {useEffect,useState} from "react";
import LitixIcon from "./LitixIcon";
export default function LitixVerifiedActivity(){
 const [data,setData]=useState(null);
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/telemetry",{cache:"no-store",signal:controller.signal})
   .then(r=>r.ok?r.json():null).then(body=>{
    if(body?.available===true)setData(body);
   }).catch(()=>{});
  return()=>controller.abort();
 },[]);
 if(!data||(!data.ordersDeliveredToday&&!data.activeServicesCount))return null;
 return <p className="litix-verified-activity" role="status" aria-label="Verified Litix 24-hour operational statistics">
  <LitixIcon name="badge-check" size={17}/>
  {data.ordersDeliveredToday>0?
   data.ordersDeliveredToday.toLocaleString("en-US")+" confirmed completed order"+(data.ordersDeliveredToday===1?"":"s")+" in the last 24 hours":
   data.activeServicesCount.toLocaleString("en-US")+" currently enabled service"+(data.activeServicesCount===1?"":"s")}
 </p>;
}
