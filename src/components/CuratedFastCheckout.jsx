"use client";
import {useEffect,useMemo,useState} from "react";
import {CORE_KINDS,CORE_PLATFORMS,CORE_QUANTITIES,TIKTOK_EXTRA_KINDS} from "../config/curatedServices.mjs";

const usd=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents||0)/100);
const friendly=kind=>kind==="story_views"?"Story Views":kind[0].toUpperCase()+kind.slice(1);

export default function CuratedFastCheckout({selected,quantity,onChoose,onQuantityChange}){
 const [platform,setPlatform]=useState("Instagram");
 const [kind,setKind]=useState("followers");
 const [tier,setTier]=useState("standard");
 const [products,setProducts]=useState([]);
 const [status,setStatus]=useState("loading");
 const [retry,setRetry]=useState(0);
 const [customOpen,setCustomOpen]=useState(false);
 const [extraMessage,setExtraMessage]=useState("");
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  setStatus("loading");
  fetch("/api/catalog/curated",{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const data=await response.json();
    if(!response.ok||!Array.isArray(data.products))throw Error("catalog_unavailable");
    return data.products;
   }).then(data=>{if(active){setProducts(data);setStatus("ready");}})
   .catch(()=>{if(active){setProducts([]);setStatus("error");}});
  return()=>{active=false;controller.abort()};
 },[retry]);
 const find=(p,k,t)=>products.find(x=>x.platform===p&&x.kind===k&&x.tier===t)||null;
 const current=useMemo(()=>find(platform,kind,tier)||find(platform,kind,"standard"),[products,platform,kind,tier]);
 useEffect(()=>{
  if(status!=="ready"){if(status==="error")onChoose(null);return;}
  if(!current){
   if(selected?.id)onChoose(null);
   return;
  }
  if(selected?.id!==current.id||
     selected?.per1000!==current.per1000||
     selected?.min!==current.min||selected?.max!==current.max){
   onChoose(current);
  }
 },[status,current?.id,current?.per1000,current?.min,current?.max]);
 const go=(p,k,t="standard")=>{
  setPlatform(p);setKind(k);setTier(t);setCustomOpen(false);setExtraMessage("");
  const next=find(p,k,t)||find(p,k,"standard");
  onChoose(next);
 };
 const exactQuantity=CORE_QUANTITIES.find(x=>x===quantity);
 const selectedPrice=exactQuantity!==undefined?current?.quantityCards?.find(x=>x.quantity===quantity):null;
 const isEligible=quantity>=Number(current?.min)&&quantity<=Number(current?.max)&&
  Number.isSafeInteger(quantity)&&
  (selectedPrice?selectedPrice.available:true);
 const extraClick=entry=>{
  if(["auto_likes","auto_views"].includes(entry.kind)){
   setExtraMessage("Recurring Auto Likes and Views are currently unavailable for new purchases.");
   return;
  }
  if(find("TikTok",entry.kind,"standard"))go("TikTok",entry.kind);
  else setExtraMessage("This add-on is not currently available for quick checkout. Browse the full catalog for alternatives.");
 };
 return <section className="litix-curated" aria-label="Quick Instagram and TikTok checkout">
  <header className="litix-curated-intro">
   <span className="kicker">FAST CHECKOUT · TWO EASY CHOICES</span>
   <p>Choose your platform and service. Your package price appears below.</p>
  </header>
  <div className="litix-curated-step">
   <div className="litix-curated-heading"><span>01</span><strong>Choose Platform</strong></div>
   <div className="litix-curated-platforms" role="group" aria-label="Choose social platform">
    {CORE_PLATFORMS.map(p=><button key={p} className={platform===p?"is-selected":""}
     type="button" aria-pressed={platform===p} onClick={()=>go(p,"followers")}>{p}</button>)}
   </div>
   <a className="litix-curated-browse" href="/services">Need YouTube, Facebook or X? Browse full catalog →</a>
  </div>
  <div className="litix-curated-step">
   <div className="litix-curated-heading"><span>02</span><strong>Choose Service</strong></div>
   <div className="litix-curated-kinds" role="group" aria-label="Choose service type">
    {CORE_KINDS.map(k=><button key={k} type="button" className={kind===k?"is-selected":""}
     aria-pressed={kind===k} disabled={status!=="ready"||!find(platform,k,"standard")}
     onClick={()=>go(platform,k)}>{friendly(k)}</button>)}
   </div>
   {platform==="TikTok"&&<div className="litix-curated-extras">
    <span>More TikTok options</span>
    <div role="group" aria-label="More TikTok service options">
     {TIKTOK_EXTRA_KINDS.map(x=><button key={x.kind} type="button"
      aria-pressed={kind===x.kind}
      disabled={["auto_likes","auto_views"].includes(x.kind)}
      onClick={()=>extraClick(x)}>{x.label}</button>)}
    </div>
    <a href="/services?platform=TikTok">Monthly growth and engagement packages in full catalog →</a>
    <button type="button" className="litix-curated-subtle" disabled
     title="Custom Comments needs a verified non-Default supplier delivery flow">Custom Comments · Not yet available</button>
   </div>}
   {extraMessage&&<p className="litix-curated-notice" role="status">{extraMessage}</p>}
  </div>
  <div className="litix-curated-step">
   <div className="litix-curated-heading"><span>03</span><strong>Quality</strong></div>
   <div className="litix-curated-tiers" role="group" aria-label="Choose quality">
    <button type="button" className={tier==="standard"?"is-selected":""}
     aria-pressed={tier==="standard"} disabled={!find(platform,kind,"standard")}
     onClick={()=>go(platform,kind,"standard")}>High Quality <small>Standard</small></button>
    <button type="button" className={tier==="vip"?"is-selected":""}
     aria-pressed={tier==="vip"} disabled={!find(platform,kind,"vip")}
     onClick={()=>go(platform,kind,"vip")}>Real / Active VIP <small>{find(platform,kind,"vip")?"Alternate tier":"Not currently verified"}</small></button>
   </div>
  </div>
  {status==="loading"&&<p className="litix-curated-notice" role="status">Checking live service availability…</p>}
  {status==="error"&&<p role="alert" className="litix-curated-notice">Live packages could not be verified. No payment can be made.
   <button type="button" onClick={()=>setRetry(i=>i+1)}>Retry packages</button></p>}
  {status==="ready"&&!current&&<p role="status" className="litix-curated-notice">This service is currently unavailable in quick checkout. Try another service or browse the full catalog.</p>}
  {current&&<div className="litix-curated-packages">
   <div className="litix-curated-heading"><span>04</span><strong>Choose Quantity</strong></div>
   <p className="litix-curated-tier-description">{current.label} · {Number(current.min).toLocaleString()}–{Number(current.max).toLocaleString()} units</p>
   <div role="group" aria-label="Quantity package cards" className="litix-curated-package-grid">
    {current.quantityCards.map(card=><button key={card.quantity} type="button"
     className={quantity===card.quantity?"is-selected":""}
     aria-pressed={quantity===card.quantity} disabled={!card.available}
     onClick={()=>{onQuantityChange(card.quantity);setCustomOpen(false);}}>
     {card.quantity===1000&&<span className="litix-curated-featured">FEATURED</span>}
     <strong>{card.quantity.toLocaleString()}</strong><span>{friendly(kind)}</span>
     <b>{card.available?usd(card.totalCents):"Unavailable"}</b>
    </button>)}
   </div>
   <button type="button" className="litix-curated-custom-toggle" aria-expanded={customOpen}
    onClick={()=>setCustomOpen(v=>!v)}>Custom amount {customOpen?"−":"+"}</button>
   {customOpen&&<label className="litix-curated-custom" htmlFor="litix-quantity-custom">Custom quantity
    <input type="number" id="litix-quantity-custom" aria-label="Custom quantity"
     value={quantity} min={current.min} max={current.max} step="1"
     onChange={e=>onQuantityChange(Number(e.target.value))}
     onBlur={()=>onQuantityChange(Math.max(current.min,Math.min(current.max,Number(quantity)||current.min)))}/>
   </label>}
   {!isEligible&&<p role="alert" className="litix-curated-notice">Choose a quantity within the verified limits. Unavailable package cards cannot be purchased.</p>}
  </div>}
 </section>;
}
