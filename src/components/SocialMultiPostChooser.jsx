"use client";
import {useEffect,useRef,useState} from "react";
import {canonicalPost,normalizeProfile} from "../lib/postPicker.mjs";
import {newTikTokPost} from "./TikTokMultiPostChooser";
import "./SocialMultiPostChooser.css";

const usd=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents||0)/100);
const eachCents=(service,quantity)=>Math.ceil(Number(service?.per1000||0)*Number(quantity||0)/10-1e-8);

export default function SocialMultiPostChooser({service,platform,posts,onChange}){
 const [username,setUsername]=useState("");
 const [gallery,setGallery]=useState([]);
 const [loading,setLoading]=useState(false);
 const [running,setRunning]=useState("");
 const [message,setMessage]=useState("");
 const activeLookup=useRef(null), lastAutomaticLookup=useRef("");
 const isTikTok=platform==="tiktok";
 const profileHandle=normalizeProfile(platform,username);
 // Typing and pasting a public username/profile URL loads the gallery automatically.
 // Debounce protects Apify rate limits and costs; the manual button remains a retry.
 useEffect(()=>{
  if(!profileHandle){
   activeLookup.current?.abort();
   setLoading(false);setGallery([]);setMessage("");
   return;
  }
  const key=platform+":"+profileHandle;
  if(lastAutomaticLookup.current===key)return;
  const timer=setTimeout(()=>{void lookup(null,{automatic:true})},1200);
  return()=>clearTimeout(timer);
 },[profileHandle,platform]);
 const minimum=Number(service?.min||1),maximum=Number(service?.max||1000000),unitStep=Number(service?.unitStep||1);
 const selected=new Set(posts.filter(p=>p.status==="verified"&&p.verifiedInput===p.link.trim()).map(p=>p.verifiedUrl));
 function mutate(id,fields){onChange(old=>old.map(p=>p.id===id?{...p,...fields}:p))}
 async function lookup(e,{automatic=false}={}){
  e?.preventDefault?.();
  const handle=normalizeProfile(platform,username);
  if(!handle){if(!automatic)setMessage("Enter a valid public username or profile link.");return;}
  const key=platform+":"+handle;
  if(automatic&&lastAutomaticLookup.current===key)return;
  if(loading&&!automatic)return;
  lastAutomaticLookup.current=key;
  activeLookup.current?.abort();
  const controller=new AbortController();
  activeLookup.current=controller;
  setLoading(true);setMessage("");setGallery([]);
  try{
   const q=new URLSearchParams({platform,username:handle});
   const r=await fetch("/api/post-picker?"+q,{cache:"no-store",signal:controller.signal});
   const body=await r.json();if(!r.ok)throw Error(body.error||"Public gallery unavailable");
   if(controller.signal.aborted)return;
   const eligible=(body.posts||[]).filter(p=>
    isTikTok?/\/video\/[0-9]{10,25}$/.test(p.url):/^https:\/\/www\.instagram\.com\/(?:p|reel)\//.test(p.url)
   );
   setGallery(eligible);
   setMessage(eligible.length?"Your public posts loaded automatically. Tap 1–5 posts to add likes.":"No eligible public posts found. Try again or paste a direct post link below.");
  }catch(err){
   if(!controller.signal.aborted)setMessage("Gallery temporarily unavailable. Tap Retry or add direct post links below.");
  }finally{
   if(!controller.signal.aborted)setLoading(false);
  }
 }
 function toggle(post){
  onChange(current=>{
   const exists=current.some(p=>p.status==="verified"&&p.verifiedUrl===post.url);
   if(exists)return current.filter(p=>p.verifiedUrl!==post.url);
   const nonempty=current.filter(p=>String(p.link||"").trim());
   if(nonempty.length>=5)return current;
   return [...nonempty,newTikTokPost({link:post.url,quantity:minimum,verifiedUrl:post.url})];
  });
 }
 async function verify(p){
  const input=String(p.link||"").trim();
  if(!input){mutate(p.id,{status:"error",error:"Enter a post link.",verifiedUrl:"",verifiedInput:""});return}
  setRunning(p.id);mutate(p.id,{status:"checking",verifiedUrl:"",verifiedInput:"",error:""});
  try{
   let canonical;
   if(isTikTok){
    const r=await fetch("/api/tiktok/resolve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({link:input})});
    const data=await r.json();if(!r.ok)throw Error(data.error||"TikTok video link unavailable");
    canonical=data.url;
   }else{
    canonical=canonicalPost("instagram",input);
    if(canonical&&!/^https:\/\/www\.instagram\.com\/(?:p|reel)\//.test(canonical))canonical=null;
   }
   if(!canonical)throw Error(isTikTok?"Use a public TikTok video link.":"Use a public Instagram post or Reel URL.");
   onChange(old=>old.map(item=>item.id===p.id&&item.link.trim()===input?{...item,status:"verified",verifiedUrl:canonical,verifiedInput:input,error:""}:item));
  }catch(err){onChange(old=>old.map(item=>item.id===p.id&&item.link.trim()===input?{...item,status:"error",verifiedUrl:"",verifiedInput:"",error:String(err.message).slice(0,150)}:item))}
  finally{setRunning("")}
 }
 const active=posts.filter(p=>String(p.link||"").trim());
 const cents=active.reduce((sum,p)=>sum+Math.max(0,eachCents(service,p.quantity)),0);
 const count=active.reduce((sum,p)=>sum+Number(p.quantity||0),0);
 return <div className="litix-social-picker">
   <div className="litix-picker-lookup">
    <h3>Choose Your Posts</h3>
    <p>Enter your public {isTikTok?"TikTok":"Instagram"} username or profile URL. Your posts load automatically — tap the ones you want.</p>
    <div className="litix-picker-search">
      <input value={username} placeholder={isTikTok?"@yourtiktok or TikTok profile link":"@yourinstagram or Instagram profile link"} aria-label={isTikTok?"Public TikTok username or profile link":"Public Instagram username or profile link"} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={e=>{setUsername(e.target.value);setGallery([]);setMessage("");activeLookup.current?.abort();setLoading(false)}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(profileHandle)lookup(e)}}} required/>
      <button type="button" onClick={lookup} className="alt" disabled={loading||!profileHandle}>{loading?"Loading your posts…":gallery.length?"Refresh posts":"Retry / load posts"}</button>
    </div>
    {message&&<p className="small" role="status">{message}</p>}
    {gallery.length>0&&<>
      <div className="litix-picker-heading"><strong>Tap the posts to add likes</strong><span>{selected.size} selected</span></div>
      <div className="litix-picker-gallery" role="group" aria-label="Select public social posts">
       {gallery.map((p,i)=><button type="button" key={p.url} className={selected.has(p.url)?"selected":""}
        onClick={()=>toggle(p)} aria-pressed={selected.has(p.url)} aria-label={"Select post "+(i+1)}>
        <img src={p.thumbnail} alt={p.caption||"Public social post"} loading="lazy" referrerPolicy="no-referrer"/>
        <span className="litix-picker-check" aria-hidden="true">{selected.has(p.url)?"✓":""}</span>
       </button>)}
      </div>
    </>}
   </div>
   <div className="litix-picker-manual">
    <h3>Your selected posts</h3>
    <p className="small">Choose 1–5 posts. If the gallery can't load, you can still enter direct post links as a fallback. Likes can be adjusted separately for each post.</p>
    {posts.map((p,i)=>{
      const quantity=Number(p.quantity);
      const valid=Boolean(p.verifiedUrl&&p.verifiedInput===String(p.link||"").trim()&&p.status==="verified");
      const quantityValid=Number.isSafeInteger(quantity)&&quantity>=minimum&&quantity<=maximum&&
        Number.isSafeInteger(unitStep)&&(quantity-Number(service?.supplierMin??minimum))%unitStep===0&&eachCents(service,quantity)>=100;
      return <fieldset key={p.id} className="litix-picker-entry">
        <legend>{isTikTok?"Video":"Post"} {i+1}</legend>
        <label>{isTikTok?"Public TikTok video/share link":"Public Instagram post or Reel link"}
         <input type="url" placeholder={isTikTok?"https://www.tiktok.com/@user/video/...":"https://www.instagram.com/p/..."}
          value={p.link} onChange={e=>mutate(p.id,{link:e.target.value,status:"idle",verifiedUrl:"",verifiedInput:"",error:""})}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}/>
        </label>
        <div className="litix-picker-verify">
         <button className="alt" type="button" disabled={running===p.id} onClick={()=>verify(p)}>
          {running===p.id?"Verifying…":valid?"Verified ✓":"Verify post"}</button>
         {valid&&<a href={p.verifiedUrl} target="_blank" rel="noopener noreferrer">View post</a>}
         {p.status==="error"&&<span role="alert" className="small">{p.error}</span>}
        </div>
        <label>Likes for {isTikTok?"video":"post"} {i+1}
         <input type="number" value={p.quantity} min={minimum} max={maximum} step={unitStep} onChange={e=>mutate(p.id,{quantity:e.target.value===""?0:Number(e.target.value)})}/>
        </label>
        <p className="small">{quantityValid?usd(eachCents(service,quantity)):"Minimum "+minimum.toLocaleString()+" likes per post"} · {valid?"Post verified":"Post needs verification"}</p>
        {posts.length>1&&<button type="button" className="alt" onClick={()=>onChange(old=>old.filter(item=>item.id!==p.id))}>Remove</button>}
      </fieldset>
    })}
    {posts.length<5&&<button type="button" className="alt" onClick={()=>onChange(old=>[...old,newTikTokPost({quantity:minimum})])}>Add another post</button>}
    <div className="totalbox"><strong>{posts.length} posts · {count.toLocaleString()} likes</strong>
      <p className="small">Combined price: {usd(cents)}. One PayKings charge for all selected posts.</p>
    </div>
    <p className="small">Fulfillment is coordinated separately for each post after confirmed payment. Do not pay again while a paid order is being processed.</p>
   </div>
  </div>
}
