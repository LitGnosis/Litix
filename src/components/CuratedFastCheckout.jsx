"use client";
import {useEffect,useMemo,useState} from "react";
import {CORE_KINDS,CORE_PLATFORMS,CORE_QUANTITIES} from "../config/curatedServices.mjs";
import {STATIC_CURATED_PREVIEW} from "../lib/curatedStaticPreview.mjs";
import {DEFAULT_CURATED_SKU,initialCuratedOffer,formatCuratedUnitRange} from "../lib/litixCuratedFirstPaint.mjs";
import {curatedQuantityBadge} from "../lib/litixCuratedSavings.mjs";
import LitixFollowerTierGrid from "./LitixFollowerTierGrid.jsx";

const usd=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents||0)/100);
const friendly=kind=>kind==="story_views"?"Story Views":kind[0].toUpperCase()+kind.slice(1);

export default function CuratedFastCheckout({selected,quantity,onChoose,onQuantityChange,onBrowsePlatform,initialServiceId=DEFAULT_CURATED_SKU}){
 const initial=initialCuratedOffer(initialServiceId);
 const [platform,setPlatform]=useState(initial?.platform||"Instagram");
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const match=/^curated_(instagram|tiktok)_(followers|likes|views|comments)_(standard|value|vip)$/.exec(params.get("service")||"");
  if(!match)return;
  setPlatform(match[1]==="instagram"?"Instagram":"TikTok");
  setKind(match[2]);setTier(match[3]);
 },[]);
 const [kind,setKind]=useState(initial?.kind||"followers");
 const [tier,setTier]=useState(initial?.tier||"standard");
 const [products,setProducts]=useState(STATIC_CURATED_PREVIEW);
 const [status,setStatus]=useState("preview");
 const [retry,setRetry]=useState(0);
 const [customOpen,setCustomOpen]=useState(false);
 const [customQuoteError,setCustomQuoteError]=useState("");
 const [quoteRetry,setQuoteRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  if(retry>0)setStatus("preview");
  fetch("/api/catalog/curated",{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const data=await response.json();
    if(!response.ok||!Array.isArray(data.products))throw Error("catalog_unavailable");
    return data.products;
   }).then(data=>{if(active){setProducts(data);setStatus("ready");}})
   .catch(()=>{if(active){setStatus("error");}});
  return()=>{active=false;controller.abort()};
 },[retry]);
 const find=(p,k,t)=>products.find(x=>x.platform===p&&x.kind===k&&x.tier===t)||null;
 const live=(p,k,t)=>status==="ready"?find(p,k,t):null;
 const current=useMemo(()=>find(platform,kind,tier)||find(platform,kind,"standard"),[products,platform,kind,tier]);
 useEffect(()=>{
  if(status!=="ready"){return;}
  if(tier!=="standard"&&!find(platform,kind,tier))setTier("standard");
  if(!current){
   if(selected?.id)onChoose(null);
   return;
  }
  if(selected?.id!==current.id||
     selected?.per1000!==current.per1000||
     selected?.quantityCards?.find(c=>c.quantity===quantity)?.totalCents!==
      current.quantityCards?.find(c=>c.quantity===quantity)?.totalCents||
     selected?.min!==current.min||selected?.max!==current.max){
   onChoose(current);
  }
 },[status,current?.id,current?.per1000,current?.min,current?.max,current?.quantityCards,quantity]);
 const go=(p,k,t="standard")=>{
  setPlatform(p);setKind(k);setTier(t);setCustomOpen(false);
  const next=live(p,k,t)||live(p,k,"standard")||
    (status==="ready"?null:find(p,k,t)||find(p,k,"standard"));
  onChoose(next);
 };
 const exactQuantity=CORE_QUANTITIES.find(x=>x===quantity);
 const selectedPrice=current?.quantityCards?.find(x=>x.quantity===quantity)||null;
 const customQuotePending=status==="ready"&&!!current&&!selectedPrice&&
  Number.isSafeInteger(quantity)&&quantity>=Number(current.min)&&quantity<=Number(current.max)&&
  selected?.quantityQuote?.quantity!==quantity;
 useEffect(()=>{
  setCustomQuoteError("");
  if(status!=="ready"||!current||!customQuotePending)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   const query=new URLSearchParams({serviceId:current.id,quantity:String(quantity)});
   fetch("/api/catalog/curated/quote?"+query,{signal:controller.signal,cache:"no-store"})
    .then(async r=>{const data=await r.json();if(!r.ok||data.ready!==true||
     data.serviceId!==current.id||data.quantity!==quantity||
     !Number.isSafeInteger(data.totalCents)||data.totalCents<100)throw Error("quote_unavailable");return data;})
    .then(data=>{
     if(!controller.signal.aborted)
      onChoose({...current,quantityQuote:{quantity:data.quantity,totalCents:data.totalCents,
       volumeDiscountPercent:data.volumeDiscountPercent||0}});
    })
    .catch(()=>{if(!controller.signal.aborted)setCustomQuoteError("Could not verify this custom quantity. Retry the live quote before paying.");});
  },280);
  return()=>{clearTimeout(timer);controller.abort()};
 },[status,current?.id,quantity,customQuotePending,quoteRetry]);
 const isEligible=quantity>=Number(current?.min)&&quantity<=Number(current?.max)&&
  Number.isSafeInteger(quantity)&&
  (selectedPrice?selectedPrice.available:true);
 const preview=status!=="ready";
 return <section className="litix-curated" aria-label="Quick Instagram and TikTok checkout">
  <header className="litix-curated-intro">
   <span className="kicker">YOUR LITIX ORDER · LIVE PRICING</span>
   <p>Choose your service, quality and quantity. Review your live total before payment.</p>
  </header>
  <div className="litix-curated-step">
   <div className="litix-curated-heading"><span>01</span><strong>Choose Platform</strong></div>
   <div className="litix-curated-platforms" role="group" aria-label="Choose social platform">
    {["Instagram","TikTok","YouTube","Facebook","Twitter (X)"].map(p=><button key={p} className={platform===p?"is-selected":""}
     type="button" aria-pressed={platform===p} onClick={()=>CORE_PLATFORMS.includes(p)?go(p,"followers"):onBrowsePlatform?.(p)}>{p==="Twitter (X)"?"X":p}</button>)}
   </div>
  </div>
  <div className="litix-curated-step">
   <div className="litix-curated-heading"><span>02</span><strong>Choose Service</strong></div>
   <div className="litix-curated-kinds" role="group" aria-label="Choose service type">
    {CORE_KINDS.map(k=><button key={k} type="button" className={kind===k?"is-selected":""}
     aria-pressed={kind===k} disabled={status==="ready"&&!find(platform,k,"standard")}
     onClick={()=>go(platform,k)}>{friendly(k)}</button>)}
   </div>
   {platform==="TikTok"&&<div className="litix-curated-extras">
    <span>More TikTok services</span>
    <div role="group" aria-label="Browse additional TikTok services">
     <a href="/services?platform=TikTok&kind=shares">TikTok Shares</a>
     <a href="/services?platform=TikTok&kind=saves">TikTok Saves</a>
    </div>
    <a href="/services?platform=TikTok">Browse all TikTok services →</a>
   </div>}
  </div>
  <div className="litix-curated-step">
   <div className="litix-curated-heading"><span>03</span><strong>Quality</strong></div>
   <div className="litix-curated-tiers" role="group" aria-label="Choose quality">
    <button type="button" className={tier==="standard"?"is-selected":""}
     aria-pressed={tier==="standard"} disabled={status==="ready"&&!find(platform,kind,"standard")}
     onClick={()=>go(platform,kind,"standard")}>
     <span>{live(platform,kind,"standard")?.label==="Active-look service"?"Active":"High Quality"}</span>
     <small>Recommended · High-quality service</small>
     <span className="litix-tier-benefit">Standard queue · Refill options depend on service eligibility</span>
    </button>
    {live(platform,kind,"vip")&&<button type="button" className={tier==="vip"?"is-selected":""}
     aria-pressed={tier==="vip"} onClick={()=>go(platform,kind,"vip")}><span>VIP / Active</span><small>Active-profile listing · Current service price</small>
      <span className="litix-tier-benefit">Delivery and refill terms shown only where verified</span></button>}
   </div>
  </div>
  {status==="error"&&<p className="litix-curated-notice" role="alert">Secure price verification is unavailable. Retry to continue.</p>}
  {status==="error"&&<button className="litix-curated-custom-toggle" type="button" onClick={()=>setRetry(i=>i+1)}>Retry live pricing</button>}
  {status==="ready"&&!current&&<p role="status" className="litix-curated-notice">This service is currently unavailable in quick checkout. Try another service or browse the full catalog.</p>}
  {current&&<div className="litix-curated-packages">
   <div className="litix-curated-heading"><span>04</span><strong>Choose Quantity</strong></div>
   <p className="litix-curated-tier-description">
    {current.preview?"High Quality":current.label} · <span className="litix-curated-range">{status==="ready"?"● Quantity limits checked · "+formatCuratedUnitRange(current.min,current.max):"Pricing preview · verifying current limits"}</span>
   </p>
   {kind==="followers"?<LitixFollowerTierGrid product={current} quantity={quantity} onQuantityChange={onQuantityChange}
    quotedCents={selectedPrice?.totalCents??(selected?.quantityQuote?.quantity===quantity?selected.quantityQuote.totalCents:null)}
    quotePending={customQuotePending}/>:
   <div role="group" aria-label="Quantity package cards" className="litix-curated-package-grid">
    {current.quantityCards.map(card=><button key={card.quantity} type="button"
     className={quantity===card.quantity?"is-selected":""}
     aria-pressed={quantity===card.quantity} disabled={status==="ready"&&!card.available}
     onClick={()=>{onQuantityChange(card.quantity);setCustomOpen(false);}}>
     {card.quantity===1000&&<span className="litix-curated-featured">
      {curatedQuantityBadge(current.quantityCards,card.quantity,{live:status==="ready"})||"FEATURED"}
     </span>}
     {[2500,5000].includes(card.quantity)&&
      <span className="litix-curated-featured">
       {curatedQuantityBadge(current.quantityCards,card.quantity,{live:status==="ready"})}
      </span>}
     {card.quantity>5000&&card.quantity===Number(current.max)&&
      <span className="litix-curated-featured">MAX AVAILABLE{status==="ready"&&card.volumeDiscountPercent>0?" · SAVE "+card.volumeDiscountPercent+"%":""}</span>}
     <strong>{card.quantity.toLocaleString()}</strong><span>{friendly(kind)}</span>
     <b>{card.totalCents!==null&&card.totalCents!==undefined?usd(card.totalCents):status==="ready"?"Unavailable":"Check live price"}</b>
    </button>)}
   </div>}
   {status==="ready"&&<p className="litix-curated-notice">Available quantities and discounts come from the current verified Litix service quote. The final total is verified before payment.</p>}
   {status==="ready"&&<a className="litix-curated-browse"
    href={"/services?platform="+encodeURIComponent(platform)+"&kind="+encodeURIComponent(kind)}>
    Need a higher limit? Browse other {platform} {friendly(kind)} options →</a>}
   {kind!=="followers"&&<button type="button" className="litix-curated-custom-toggle" aria-expanded={customOpen}
    onClick={()=>setCustomOpen(v=>!v)}>Custom amount {customOpen?"−":"+"}</button>}
   {kind!=="followers"&&customOpen&&<label className="litix-curated-custom" htmlFor="litix-quantity-custom">Custom quantity
    <input type="number" id="litix-quantity-custom" aria-label="Custom quantity"
     value={quantity} min={current.min} max={current.max} step="1"
     onChange={e=>onQuantityChange(Number(e.target.value))}
     onBlur={()=>onQuantityChange(Math.max(current.min,Math.min(current.max,Number(quantity)||current.min)))}/>
   </label>}
   {selected?.quantityQuote?.quantity===quantity&&selected.quantityQuote.volumeDiscountPercent>0&&
    <p role="status" className="litix-curated-notice">Volume savings applied: {selected.quantityQuote.volumeDiscountPercent}% off this quantity.</p>}
   {customQuotePending&&<p role="status" className="litix-curated-notice">Checking your custom price against current availability…</p>}
   {customQuoteError&&<p role="alert" className="litix-curated-notice">{customQuoteError} <button type="button" onClick={()=>setQuoteRetry(v=>v+1)}>Retry price</button></p>}
   {!preview&&!isEligible&&<p role="alert" className="litix-curated-notice">Choose a quantity within the verified limits. Unavailable package cards cannot be purchased.</p>}
  </div>}
 </section>;
}
