"use client";
import {useEffect,useState} from "react";
import {normalizeProfileDestination} from "../lib/litixOrderTarget.mjs";
import LitixIcon from "./LitixIcon";

export default function LitixProfilePreview({platform,value}){
 const [data,setData]=useState(null);
 const normalized=normalizeProfileDestination(value,platform);
 const handle=normalized.ok&&normalized.url
  ?(platform==="tiktok"?new URL(normalized.url).pathname.slice(2).replace(/\/$/,""):
    new URL(normalized.url).pathname.slice(1).replace(/\/$/,"")):"";
 useEffect(()=>{
  setData(null);
  if(!["instagram","tiktok"].includes(platform)||!handle)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   const q=new URLSearchParams({platform,username:handle});
   fetch("/api/social/preview?"+q.toString(),{cache:"no-store",signal:controller.signal})
    .then(async res=>res.ok?res.json():null)
    .then(body=>{if(!controller.signal.aborted&&body?.publicProfileVerified&&
     body.platform===platform&&body.username===handle.toLowerCase())setData(body)})
    .catch(()=>{});
  },850);
  return()=>{clearTimeout(timer);controller.abort()};
 },[platform,handle]);
 if(!data)return null;
 return <div className="litix-profile-preview" role="status" aria-label="Verified public profile preview">
  {data.avatar?<img src={data.avatar} alt="" referrerPolicy="no-referrer" loading="lazy"/>:
   <span className="litix-profile-placeholder"><LitixIcon name="badge-check" size={22}/></span>}
  <div className="litix-profile-details">
   <strong>@{data.username}</strong>
   <small>{data.followerCount===null?"Public profile found":
    data.followerCount.toLocaleString("en-US")+" public followers"} · Public preview</small>
  </div>
 </div>;
}
