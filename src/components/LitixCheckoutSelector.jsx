"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {LITIX_CUSTOM_QUICK_PICKS,litixPreferredCustomService} from "../lib/litixCustomQuickPick.mjs";
import {CHECKOUT_PLATFORMS,choicesForPlatform,combineCheckoutChoices,
 defaultKindFor,firstPackageFor} from "../lib/litixCheckoutBootstrap.mjs";

const usd=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents)/100);
const INITIAL=choicesForPlatform("Instagram");

export default function LitixCheckoutSelector({selected,onChoose}){
 const [platform,setPlatform]=useState("Instagram");
 const [kind,setKind]=useState(defaultKindFor(INITIAL,"followers"));
 const [data,setData]=useState(INITIAL);
 const [refreshing,setRefreshing]=useState(false);
 const [problem,setProblem]=useState("");
 const [retry,setRetry]=useState(0);
 const selectedRef=useRef(selected);
 const chooseRef=useRef(onChoose);
 selectedRef.current=selected;chooseRef.current=onChoose;

 // Render real, previously verified Instagram Followers packages immediately:
 // no network, no storage, and no loading gate on the initial render.
 useEffect(()=>{
  const requested=new URLSearchParams(window.location.search).get("service");
  if(!selectedRef.current?.id&&!/^(?:litix|boostero)_\d{1,12}$/.test(requested||"")){
   const item=firstPackageFor(INITIAL,defaultKindFor(INITIAL,"followers"));
   if(item)chooseRef.current(item);
  }
 },[]);

 // A directory deep-link or other external selection can still choose a card.
 useEffect(()=>{
  if(!selected?.id)return;
  if(selected.platform&&selected.platform!==platform){
   const choice=choicesForPlatform(selected.platform);
   setData(choice);
   setPlatform(choice.platform);
   setKind(defaultKindFor(choice,selected.kind));
  }else if(selected.kind&&selected.kind!==kind)setKind(selected.kind);
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
    const selectedNow=selectedRef.current;
    const wanted=(selectedNow?.platform===platform?selectedNow.kind:kind);
    const resolvedKind=defaultKindFor(next,wanted);
    setKind(resolvedKind);
    const same=next.items.find(x=>x.id===selectedNow?.id&&x.kind===resolvedKind);
    if(!same){
     const first=litixPreferredCustomService(next.items,platform,resolvedKind)||
      firstPackageFor(next,resolvedKind);
     if(first)chooseRef.current(first);
    }
   })
   .catch(error=>{
    if(!active)return;
    console.warn("Litix checkout catalog background refresh failed:",String(error?.name||"error"));
    setProblem("Latest package updates are temporarily unavailable. Browse saved verified options and retry.");
   })
   .finally(()=>{clearTimeout(timeout);if(active)setRefreshing(false)});
  return()=>{active=false;clearTimeout(timeout);ctrl.abort()};
 },[platform,retry]);

 const filtered=useMemo(()=>data.items.filter(row=>row.kind===kind),[data.items,kind]);
 const current=selected?.platform===platform&&selected?.kind===kind?selected:null;
 const extra=current&&!filtered.some(s=>s.id===current.id)?current:null;

 function moveTo(nextPlatform,nextKind="followers"){
  const instant=choicesForPlatform(nextPlatform);
  const targetKind=defaultKindFor(instant,nextKind);
  setPlatform(instant.platform);
  setKind(targetKind);
  setData(instant);
  setProblem("");
  const first=litixPreferredCustomService(instant.items,instant.platform,targetKind)||
   firstPackageFor(instant,targetKind);
  chooseRef.current(first);
 }
 function changeKind(nextKind){
  setKind(nextKind);
  const first=litixPreferredCustomService(data.items,platform,nextKind)||
   firstPackageFor(data,nextKind);
  chooseRef.current(first);
 }
 function changeService(id){
  const item=filtered.find(s=>s.id===id);
  if(item)chooseRef.current(item);
 }

 return <div className="litix-quick-selector" aria-label="Choose a Litix service">
  <div className="litix-quick-intro">
   <span className="litix-quick-eyebrow">FAST CHECKOUT · 3 STEPS</span>
   <p>Choose a platform and package, then paste your public profile or post link. Prices are rechecked before payment.</p>
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
    <select id="litix-platform" aria-label="Choose social platform"
     value={platform} onChange={e=>moveTo(e.target.value)}>
     {CHECKOUT_PLATFORMS.map(name=><option key={name} value={name}>{name}</option>)}
    </select>
   </label>
   <label htmlFor="litix-service-kind"><span className="litix-quick-number">02</span> Service type
    <select id="litix-service-kind" aria-label="Choose followers, likes or another service"
     value={kind} disabled={!data.kinds.length}
     onChange={e=>changeKind(e.target.value)}>
     {data.kinds.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}
     {!data.kinds.length&&<option value="">No packages for this platform</option>}
    </select>
   </label>
  </div>
  <label htmlFor="litix-service-choice" className="litix-quick-package">
   <span><span className="litix-quick-number">03</span> Choose your package</span>
   <select id="litix-service-choice" aria-label="Choose a verified Litix service and price"
    value={current?.id||""} disabled={!filtered.length}
    onChange={e=>changeService(e.target.value)}>
    {!current&&<option value="">{filtered.length?"Choose a package":"No verified packages for this service type"}</option>}
    {extra&&<option value={extra.id}>{extra.name} · {usd(Math.ceil(Number(extra.per1000)*100))}/1,000</option>}
    {filtered.map(service=><option key={service.id} value={service.id}>
     {service.name} · {usd(Math.ceil(service.per1000*100))}/1,000
    </option>)}
   </select>
  </label>
  {refreshing&&<p role="status" className="litix-quick-status">Checking for updated packages in the background…</p>}
  {problem&&<p role="status" className="litix-quick-status">{problem}</p>}
  {!filtered.length&&<div className="litix-quick-error" role="status">
   No previously verified {kind||"service"} packages are available for {platform}.
   <button type="button" className="alt" onClick={()=>setRetry(x=>x+1)}>Retry services</button>
  </div>}
  {filtered.length>0&&<div className="litix-quick-status">
   {data.catalogStatus==="static"?"Previously verified Litix listings — browse now; live price is checked before payment.":
    "Verified Litix listings — final price and availability checked before payment."}
   {problem&&<button type="button" className="alt" onClick={()=>setRetry(x=>x+1)}>Retry services</button>}
  </div>}
  {current&&<div className="litix-quick-chosen" aria-live="polite">
   <strong>{current.name}</strong>
   <span>{usd(Math.ceil(current.per1000*100))} per 1,000 · Minimum {current.min.toLocaleString()} · Maximum {current.max.toLocaleString()}</span>
  </div>}
 </div>;
}
