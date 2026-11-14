"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {LITIX_CUSTOM_QUICK_PICKS,litixPreferredCustomService} from "../lib/litixCustomQuickPick.mjs";
const dollars=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents)/100);
const DEFAULT_PLATFORMS=["Instagram","TikTok","YouTube","Facebook","Twitter (X)"];
const CACHE_PREFIX="litix:verified-checkout-choices:v2:";
const EMPTY=Object.freeze({platforms:[],kinds:[],items:[],total:0,note:"",liveAvailability:false});
function storedChoices(platform){
 if(typeof window==="undefined")return null;
 try{
  const item=JSON.parse(sessionStorage.getItem(CACHE_PREFIX+platform)||"null");
  if(!item||item.platform!==platform||Date.now()-item.savedAt>24*60*60*1000||Date.now()<item.savedAt
    ||!Array.isArray(item.data?.items)||!Array.isArray(item.data?.kinds))return null;
  const items=item.data.items.filter(x=>/^litix_\d{1,12}$/.test(String(x?.id||""))
    &&x.platform===platform&&Number(x.per1000)>0&&Number(x.min)>0).slice(0,3000);
  return {...item.data,items,liveAvailability:false,
   note:"Showing recently verified Litix listings. Prices and availability are rechecked before payment."};
 }catch{return null}
}
function saveChoices(platform,value){
 if(typeof window==="undefined"||!value||!Array.isArray(value.items))return;
 try{sessionStorage.setItem(CACHE_PREFIX+platform,JSON.stringify({
  platform,savedAt:Date.now(),data:{...value,
    // Public display state only, not a live checkout authorization.
    liveAvailability:false,
    items:value.items.slice(0,3000),kinds:value.kinds||[],platforms:value.platforms||[]}
 }))}catch{/* Browsers without session storage can still load the API. */}
}

export default function LitixCheckoutSelector({selected,onChoose}){
 const [platform,setPlatform]=useState("Instagram");
 const [kind,setKind]=useState("followers");
 const [data,setData]=useState(EMPTY);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const pendingIntent=useRef(null);
 // Honor service deep links from All Litix Services; never select a package
 // without customer input.
 useEffect(()=>{
  if(!selected?.id)return;
  if(selected.platform&&selected.platform!==platform){
   setPlatform(selected.platform);
   setKind(selected.kind||"other");
  }else if(selected.kind&&selected.kind!==kind){
   setKind(selected.kind);
  }
 },[selected?.id]);
 useEffect(()=>{
  let cancelled=false;
  const controller=new AbortController();
  const cached=storedChoices(platform);
  // A session snapshot renders immediately on return visits and platform changes.
  // Network refresh continues without disabling the choices already on screen.
  setData(cached||EMPTY);
  setLoading(!cached);
  setError("");
  if(cached){
   const intent=pendingIntent.current;
   const kinds=cached.kinds||[];
   if(intent?.platform===platform&&cached.items.length){
    pendingIntent.current=null;
    const type=kinds.some(k=>k.value===intent.kind)?intent.kind:kinds[0]?.value||"";
    setKind(type);
    onChoose(litixPreferredCustomService(cached.items,platform,type));
   }else{
    setKind(previous=>kinds.some(k=>k.value===previous)?previous:(kinds[0]?.value||""));
   }
  }
  const timer=setTimeout(()=>controller.abort(),5000);
  const p=new URLSearchParams({platform});
  fetch("/api/catalog/checkout-choices?"+p,{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const value=await response.json();
    if(!response.ok)throw Error(value.error||"Unable to load Litix services");
    return value;
   })
   .then(value=>{
    if(cancelled)return;
    const kinds=Array.isArray(value.kinds)?value.kinds:[];
    const items=Array.isArray(value.items)?value.items:[];
    const fresh={platforms:Array.isArray(value.platforms)?value.platforms:[],
     kinds,items,total:Number(value.total||0),note:String(value.note||""),
     liveAvailability:value.liveAvailability===true};
    setData(fresh);
    saveChoices(platform,fresh);
    const intent=pendingIntent.current;
    if(intent?.platform===platform){
     pendingIntent.current=null;
     const type=kinds.some(x=>x.value===intent.kind)?intent.kind:(kinds[0]?.value||"");
     setKind(type);onChoose(litixPreferredCustomService(items,platform,type));
    }else setKind(previous=>kinds.some(x=>x.value===previous)?previous:(kinds[0]?.value||""));
   })
   .catch(err=>{
    if(cancelled)return;
    if(cached){
     setData(previous=>({...previous,note:"Recent verified listings remain available for browsing. Retry to refresh; payment requires a fresh quote."}));
    }else{
     setError(controller.signal.aborted?"Service verification took too long. Choose another platform or retry.":err.message||"Unable to load services");
     setData(EMPTY);
    }
   })
   .finally(()=>{clearTimeout(timer);if(!cancelled)setLoading(false)});
  return()=>{cancelled=true;clearTimeout(timer);controller.abort()};
 },[platform,retry]);
 const platforms=[...DEFAULT_PLATFORMS.map(name=>({
  name,count:data.platforms.find(p=>p.name===name)?.count||0
 })),...data.platforms.filter(p=>!DEFAULT_PLATFORMS.includes(p.name))];
 const filtered=useMemo(()=>data.items.filter(x=>(x.kind||"other")===kind),[data.items,kind]);
 const actualSelected=selected?.id&&selected.platform===platform&&selected.kind===kind?
  selected:null;
 const visibleSelected=actualSelected&&!filtered.some(x=>x.id===actualSelected.id)?actualSelected:null;
 function chooseCustom(nextPlatform,nextKind){
  if(nextPlatform===platform){
   setKind(nextKind);
   if(loading||!data.items.length){
    pendingIntent.current={platform:nextPlatform,kind:nextKind};
    onChoose(null);
   }else onChoose(litixPreferredCustomService(data.items,platform,nextKind));
  }else{
   pendingIntent.current={platform:nextPlatform,kind:nextKind};
   setKind(nextKind);setPlatform(nextPlatform);onChoose(null);
  }
 }
 function changePlatform(value){
  if(value===platform)return;
  pendingIntent.current={platform:value,kind:"followers"};
  setPlatform(value);setKind("followers");onChoose(null);
 }
 function changeKind(value){
  setKind(value);
  onChoose(litixPreferredCustomService(data.items,platform,value));
 }
 function changeService(id){
  const service=data.items.find(item=>item.id===id);
  onChoose(service||null);
 }
 return <div className="litix-quick-selector" aria-label="Choose a Litix service">
  <div className="litix-quick-intro">
   <span className="litix-quick-eyebrow">FAST CHECKOUT · 3 STEPS</span>
   <p>Select your platform and what you want, then enter your profile or post link below.</p>
  </div>
  <div className="litix-custom-picks" role="group" aria-label="Quick custom Likes and Followers orders">
   {LITIX_CUSTOM_QUICK_PICKS.map(choice=><button key={choice.platform+choice.kind}
    type="button" className="litix-custom-pick"
    aria-pressed={selected?.platform===choice.platform&&selected?.kind===choice.kind}
    onClick={()=>chooseCustom(choice.platform,choice.kind)}>{choice.label}</button>)}
  </div>
  <div className="litix-quick-fields">
   <label htmlFor="litix-platform">
    <span className="litix-quick-number">01</span> Platform
    <select id="litix-platform" aria-label="Choose social platform"
     value={platform} onChange={e=>changePlatform(e.target.value)}>
     {platforms.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
     {selected?.platform&&!platforms.some(p=>p.name===selected.platform)&&<option value={selected.platform}>{selected.platform}</option>}
    </select>
   </label>
   <label htmlFor="litix-service-kind">
    <span className="litix-quick-number">02</span> Service type
    <select id="litix-service-kind" aria-label="Choose followers, likes or another service"
     value={kind} disabled={loading||!!error||!data.kinds.length}
     onChange={e=>changeKind(e.target.value)}>
     {!kind&&<option value="">Choose service type</option>}
     {data.kinds.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}
     {kind&&!data.kinds.some(k=>k.value===kind)&&<option value={kind}>{kind}</option>}
    </select>
   </label>
  </div>
  <label htmlFor="litix-service-choice" className="litix-quick-package">
   <span><span className="litix-quick-number">03</span> Choose your package</span>
   <select id="litix-service-choice" aria-label="Choose a verified Litix service and price"
    value={actualSelected?.id||""} disabled={loading||!!error||!kind}
    onChange={e=>changeService(e.target.value)}>
    <option value="">{loading?"Loading verified services…":filtered.length?"Select a package":"No matching services"}</option>
    {visibleSelected&&<option value={visibleSelected.id}>{visibleSelected.name} · {dollars(Math.ceil(visibleSelected.per1000*100))}/1,000</option>}
    {filtered.map(s=><option key={s.id} value={s.id}>
     {s.name} · {dollars(Math.ceil(s.per1000*100))}/1,000
    </option>)}
   </select>
  </label>
  {error&&<div className="litix-quick-error" role="alert">{error}
    <button type="button" className="alt" onClick={()=>setRetry(v=>v+1)}>Retry services</button>
   </div>}
  {loading&&<p role="status" className="litix-quick-status">Loading Litix packages from our verified catalog…</p>}
  {!loading&&data.note&&<p role="status" className="litix-quick-status">{data.note}</p>}
  {!loading&&!error&&!filtered.length&&<p className="litix-quick-status">No {kind||"service"} packages are listed for {platform}. Select a different service or use the full catalog.</p>}
  {actualSelected&&<div className="litix-quick-chosen" aria-live="polite">
   <strong>{actualSelected.name}</strong>
   <span>{dollars(Math.ceil(actualSelected.per1000*100))} per 1,000 · Minimum {actualSelected.min.toLocaleString()} · Maximum {actualSelected.max.toLocaleString()}</span>
  </div>}
  <a href="/services" className="litix-quick-all">Explore all Litix services and compare packages</a>
 </div>;
}
