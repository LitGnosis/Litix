"use client";
import {useEffect,useMemo,useState} from "react";
import {normalizeProfile} from "../lib/postPicker.mjs";

const numbers=value=>Number.isSafeInteger(value)&&value>=0?new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:1}).format(value):null;
export default function LitixProfilePreview({platform,value,kind,onChoosePost}){
 const handle=useMemo(()=>normalizeProfile(platform,value),[platform,value]);
 const [state,setState]=useState({key:"",loading:false,profile:null,posts:[],error:""});
 useEffect(()=>{
  if(!handle){setState({key:"",loading:false,profile:null,posts:[],error:""});return;}
  const key=platform+":"+handle,controller=new AbortController();
  setState({key,loading:true,profile:null,posts:[],error:""});
  const timer=setTimeout(async()=>{
   try{
    const q=new URLSearchParams({platform,username:handle});
    const response=await fetch("/api/profile-preview?"+q,{cache:"no-store",signal:controller.signal});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Public profile unavailable");
    if(!controller.signal.aborted)setState({key,loading:false,profile:data.profile||null,
      posts:Array.isArray(data.posts)?data.posts:[],error:""});
   }catch{
    if(!controller.signal.aborted)setState({key,loading:false,profile:null,posts:[],
      error:"Public preview unavailable. Confirm your account is public, or paste a direct post link."});
   }
  },650);
  return()=>{clearTimeout(timer);controller.abort()};
 },[platform,handle]);
 if(!handle||!["instagram","tiktok"].includes(platform))return null;
 const current=state.key===platform+":"+handle?state:{loading:true,profile:null,posts:[],error:""};
 const avatar=current.profile?.avatarUrl;
 const followerCount=numbers(current.profile?.followersCount);
 const likesCount=numbers(current.profile?.likesCount);
 return <section className="litix-profile-preview" aria-label="Public profile and post preview">
   <div className="litix-profile-line">
    <span className="litix-profile-avatar">{avatar?<img src={avatar} alt="" loading="lazy" referrerPolicy="no-referrer"/>:"@"}</span>
    <div><strong>@{handle}</strong><small>{current.loading?"Fetching public profile…":
      current.error||"Review the public account before checkout"}</small></div>
   </div>
   {(followerCount||likesCount)&&<div className="litix-profile-stats">
    {followerCount&&<span>{followerCount} followers</span>}
    {likesCount&&<span>{likesCount} likes</span>}
   </div>}
   {["likes","views","comments"].includes(kind)&&current.posts.length>0&&
    <div className="litix-profile-gallery" aria-label="Select a recent public post">
     {current.posts.slice(0,9).map(post=><button key={post.url} type="button"
       title="Choose this public post" aria-label="Choose a public post"
       onClick={()=>onChoosePost(post.url)}>
       <img src={post.thumbnail} alt={post.caption||"Public post"} loading="lazy" referrerPolicy="no-referrer"/>
     </button>)}
    </div>}
   {["likes","views","comments"].includes(kind)&&current.posts.length>0&&
     <p className="litix-profile-footnote">Tap a post to use its link. For up to five posts, choose the multi-post option where available.</p>}
 </section>;
}
