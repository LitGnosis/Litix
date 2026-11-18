"use client";
import {useEffect,useMemo,useState} from "react";
import {normalizeProfile} from "../lib/postPicker.mjs";

const displayCount=value=>Number.isSafeInteger(value)&&value>=0?
 new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:1}).format(value):null;
export default function LitixProfilePreview({platform,value,kind,onChoosePost}){
 const needsPost=["likes","views","comments"].includes(kind);
 const [search,setSearch]=useState("");
 const handle=useMemo(()=>normalizeProfile(platform,needsPost?search:value),[platform,needsPost,search,value]);
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
    if(!response.ok)throw Error("public_profile_unavailable");
    if(!controller.signal.aborted)setState({key,loading:false,profile:data.profile||null,
      posts:Array.isArray(data.posts)?data.posts:[],error:""});
   }catch{
    if(!controller.signal.aborted)setState({key,loading:false,profile:null,posts:[],
      error:"Preview unavailable. Confirm the account is public or paste a direct post link."});
   }
  },650);
  return()=>{clearTimeout(timer);controller.abort()};
 },[platform,handle]);
 if(!["instagram","tiktok"].includes(platform))return null;
 const current=state.key===platform+":"+handle?state:
  {loading:Boolean(handle),profile:null,posts:[],error:""};
 const avatar=current.profile?.avatarUrl;
 const followers=displayCount(current.profile?.followersCount);
 const likes=displayCount(current.profile?.likesCount);
 return <section className="litix-profile-preview" aria-label="Public profile and post preview">
   {needsPost&&<label className="litix-preview-search-label">
    Find a public {platform==="instagram"?"Instagram":"TikTok"} post
    <input type="search" autoComplete="off" autoCapitalize="none" spellCheck={false}
     placeholder={"@"+(platform==="instagram"?"instagram":"tiktok")+"username"}
     aria-label="Search public profile for posts" value={search} onChange={e=>setSearch(e.target.value)}/>
    <small>Browse recent public posts or paste the post URL directly above.</small>
   </label>}
   {handle&&<div className="litix-profile-line">
    <span className="litix-profile-avatar">{avatar?<img src={avatar} alt="" loading="lazy" referrerPolicy="no-referrer"/>:"@"}</span>
    <div><strong>@{handle}</strong><small>{current.loading?"Fetching public profile…":
      current.error||"Confirm this is the right public account"}</small></div>
   </div>}
   {(followers!==null||likes!==null)&&<div className="litix-profile-stats">
    {followers!==null&&<span>{followers} followers</span>}
    {likes!==null&&<span>{likes} likes</span>}
   </div>}
   {needsPost&&current.posts.length>0&&<div className="litix-profile-gallery" aria-label="Select a recent public post">
     {current.posts.slice(0,9).map(post=><button key={post.url} type="button"
       title="Choose this public post" aria-label="Choose a public post"
       onClick={()=>onChoosePost(post.url)}>
       <img src={post.thumbnail} alt={post.caption||"Public post"} loading="lazy" referrerPolicy="no-referrer"/>
     </button>)}
   </div>}
   {needsPost&&current.posts.length>0&&
     <p className="litix-profile-footnote">Tap a post to insert its link. Multi-post selection is available for supported custom Likes packages.</p>}
 </section>;
}
