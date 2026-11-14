"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {LITIX_CUSTOM_QUICK_PICKS,litixPreferredCustomService} from "../lib/litixCustomQuickPick.mjs";
import {CHECKOUT_PLATFORMS,choicesForPlatform,combineCheckoutChoices,
 defaultKindFor,firstPackageFor} from "../lib/litixCheckoutBootstrap.mjs";
import {checkoutDisplay} from "../lib/litixCheckoutDisplay.mjs";

const usdRate=rate=>new Intl.NumberFormat("en-US",{
 style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2
}).format(Number(rate));
const INITIAL=choicesForPlatform("Instagram");

export default function LitixCheckoutSelector({selected,onChoose}){
 const [platform,setPlatform]=useState("Instagram");
 const [kind,setKind]=useState(defaultKindFor(INITIAL,"followers"));
 const [data,setData]=useState(INITIAL);
 const [refreshing,setRefreshing]=useState(false);
 const [problem,setProblem]=useState("");
 const [retry,setRetry]=useState(0);
 const [showSpecialty,setShowSpecialty]=useState(false);
 const selectedRef=useRef(selected),chooseRef=useRef(onChoose);
 selectedRef.current=selected;chooseRef.current=onChoose;

 // A deep-linked service from the main catalog may not be in the compact
 // initial fallback. Preserve that exact service instead of overriding it.
 useEffect(()=>{
  if(!selected?.id)return;
  if(selected.platform!==platform){
   const choice=choicesForPlatform(selected.platform);
   setData(choice);
   setPlatform(choice.platform);
   setKind(defaultKindFor(choice,selected.kind));
   setShowSpecialty(false);
  }else if(selected.kind!==kind)setKind(selected.kind);
 },[selected?.id]);

 useEffect(()=>{
  let active=true;
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort("catalog_refresh_deadline"),4000);
  setRefreshing(true);setProblem("");
  const query=new URLSearchParams({platform});
  fetch("/api/catalog/checkout-choices?"+query,{signal:ctrl.signal,cache:"no-store"})
   .then(async response=>{
    if(!response.ok)throw Error("catalog_http_"+response.status);
    return response.json();
   })
   .then(value=>{
    if(!active||ctrl.signal.aborted)return;
    const next=combineCheckoutChoices(platform,value,choicesForPlatform(platform));
    setData(next);
    const latest=selectedRef.current;
    const wanted=latest?.platform===platform?latest.kind:kind;
    const resolved=defaultKindFor(next,wanted);
    setKind(resolved);
    const matching=next.items.find(x=>x.id===latest?.id&&x.kind===resolved);
    // Do not preserve an obsolete price/quantity if the database has refreshed.
    if(matching){
     if(Number(latest?.per1000)!==Number(matching.per1000)||
        Number(latest?.min)!==Number(matching.min)||
        Number(latest?.max)!==Number(matching.max))chooseRef.current(matching);
    }else{
     const first=litixPreferredCustomService(next.items.filter(x=>x.kind===resolved&&
       !checkoutDisplay(x).specialty),platform,resolved)||firstPackageFor(next,resolved);
     if(first)chooseRef.current(first);
    }
   })
   .catch(error=>{
    if(!active)return;
    console.warn("Litix checkout catalog background refresh failed:",String(error?.name||"error"));
    setProblem("Latest catalog updates are temporarily unavailable. Verified saved listings remain available.");
   })
   .finally(()=>{clearTimeout(timeout);if(active)setRefreshing(false)});
  return()=>{active=false;clearTimeout(timeout);ctrl.abort()};
 },[platform,retry]);

 const filtered=useMemo(()=>data.items.filter(row=>row.kind===kind),[data.items,kind]);
 const regular=useMemo(()=>filtered.filter(x=>!checkoutDisplay(x).specialty),[filtered]);
 const specialty=useMemo(()=>filtered.filter(x=>checkoutDisplay(x).specialty),[filtered]);
 const current=selected?.platform===platform&&selected?.kind===kind?selected:null;
 const extra=current&&!filtered.some(s=>s.id===current.id)?current:null;
 const visibleSpecialty=showSpecialty||Boolean(current&&checkoutDisplay(current).specialty);

 function moveTo(nextPlatform,nextKind="followers"){
  const instant=choicesForPlatform(nextPlatform);
  const targetKind=defaultKindFor(instant,nextKind);
  setPlatform(instant.platform);setKind(targetKind);setData(instant);
  setProblem("");setShowSpecialty(false);
  const normal=instant.items.filter(x=>x.kind===targetKind&&!checkoutDisplay(x).specialty);
  const first=litixPreferredCustomService(normal,instant.platform,targetKind)||
    firstPackageFor(instant,targetKind);
  chooseRef.current(first);
 }
 function changeKind(nextKind){
  setKind(nextKind);
  setShowSpecialty(false);
  const normal=data.items.filter(x=>x.kind===nextKind&&!checkoutDisplay(x).specialty);
  chooseRef.current(litixPreferredCustomService(normal,platform,nextKind)||
   firstPackageFor(data,nextKind));
 }
 function changeService(id){
  const item=filtered.find(s=>s.id===id)||(extra?.id===id?extra:null);
  if(item)chooseRef.current(item);
 }
 const option=service=>{
  const display=checkoutDisplay(service);
  return <option key={service.id} value={service.id}>
   {display.title} · {display.subtitle} · {usdRate(service.per1000)}/1,000
  </option>;
 };

 return <div className="litix-quick-selector" aria-label="Choose a Litix service">
  <div className="litix-quick-intro">
   <span className="litix-quick-eyebrow">FAST CHECKOUT · 3 STEPS</span>
   <p>Select your platform and service. Your first recommended package and USD total are shown immediately.</p>
  </div>
  <div className="litix-custom-picks" role="group" aria-label="Quick service selection">
   {LITIX_CUSTOM_QUICK_PICKS.map(choice=><button
    key={choice.platform+choice.kind} type="button"
    className={"litix-custom-pick"+(platform===choice.platform&&kind===choice.kind?" selected":"")}
    aria-pressed={platform===choice.platform&&kind===choice.kind}
    onClick={()=>moveTo(choice.platform,choice.kind)}>{choice.label}</button>)}
  </div>
  <div className="litix-quick-fields">
   <label htmlFor="litix-platform"><span className="litix-quick-number">01</span> Platform
    <select id="litix-platform" aria-label="Choose social platform" value={platform}
     onChange={e=>moveTo(e.target.value)}>
     {CHECKOUT_PLATFORMS.map(name=><option key={name} value={name}>{name}</option>)}
    </select>
   </label>
   <label htmlFor="litix-service-kind"><span className="litix-quick-number">02</span> Service type
    <select id="litix-service-kind" aria-label="Choose followers, likes or another service"
     value={kind} disabled={!data.kinds.length} onChange={e=>changeKind(e.target.value)}>
     {data.kinds.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}
     {!data.kinds.length&&<option value="">No verified services for this platform</option>}
    </select>
   </label>
  </div>
  <label htmlFor="litix-service-choice" className="litix-quick-package">
   <span><span className="litix-quick-number">03</span> Choose your package</span>
   <select id="litix-service-choice" aria-label="Verified packages with details and USD prices"
    value={current?.id||""} disabled={!filtered.length}
    onChange={e=>changeService(e.target.value)}>
    {extra&&option(extra)}
    {regular.length>0&&<optgroup label="USA / targeted first · regular services">
     {regular.map(option)}
    </optgroup>}
    {visibleSpecialty&&specialty.length>0&&<optgroup label="Specialty / Custom · higher-price listings">
     {specialty.map(option)}
    </optgroup>}
    {!regular.length&&!visibleSpecialty&&<option value="">No regular packages — see Specialty / Custom below</option>}
   </select>
  </label>
  {specialty.length>0&&<button type="button" className="alt litix-specialty-toggle"
   aria-expanded={visibleSpecialty} onClick={()=>setShowSpecialty(v=>!v)}>
   {visibleSpecialty?"Hide specialty-priced options":"Show Specialty / Custom options"} ({specialty.length})
  </button>}
  {refreshing&&<p role="status" className="litix-quick-status">Checking catalog updates in the background…</p>}
  {problem&&<p role="status" className="litix-quick-status">{problem}
   <button type="button" className="alt" onClick={()=>setRetry(x=>x+1)}>Retry services</button></p>}
  {!filtered.length&&<div className="litix-quick-error" role="status">
   No verified {kind||"service"} packages are available for {platform}.
   <button type="button" className="alt" onClick={()=>setRetry(x=>x+1)}>Retry services</button>
  </div>}
  {filtered.length>0&&<p className="litix-quick-status">
   {data.catalogStatus==="static"?
    "Previously verified listings; final price and eligibility are checked before payment.":
    "Current Litix catalog; final price and eligibility are checked before payment."}
  </p>}
  {current&&<div className="litix-quick-chosen" aria-live="polite">
   <strong>{checkoutDisplay(current).title}</strong>
   <span>{checkoutDisplay(current).subtitle} · {usdRate(current.per1000)} per 1,000</span>
   <span>Allowed quantity: {Number(current.min).toLocaleString()}–{Number(current.max).toLocaleString()}</span>
  </div>}
 </div>;
}
