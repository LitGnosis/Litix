"use client";
import {useState} from "react";

const PRESETS=Object.freeze([100,250,500,1000,2500,5000,10000,20000]);
const money=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
export default function LitixFollowerTierGrid({product,quantity,onQuantityChange,quotedCents,quotePending}){
 const [custom,setCustom]=useState(false);
 const min=Number(product?.min||0),max=Math.min(20000,Number(product?.max||0));
 const cards=Array.isArray(product?.quantityCards)?product.quantityCards:[];
 const hundred=cards.find(row=>row.quantity===100&&row.available&&Number.isSafeInteger(row.totalCents));
 const cardFor=amount=>cards.find(row=>row.quantity===amount&&row.available&&Number.isSafeInteger(row.totalCents));
 const eligible=amount=>Number.isSafeInteger(amount)&&amount>=100&&amount<=20000&&amount>=min&&amount<=max;
 const savingsFor=amount=>{
  const priced=cardFor(amount);
  if(!hundred||!priced||amount===100)return "";
  const percent=Math.round(100*(1-(priced.totalCents*100)/(hundred.totalCents*amount)));
  return percent>0&&percent<=90?"Save "+percent+"%":"Volume package";
 };
 function continueOrder(){
  const input=document.querySelector('#checkout input[type="email"]');
  if(!input)return;
  input.scrollIntoView({block:"center",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  input.focus({preventScroll:true});
 }
 return <div className="litix-followers-nine" aria-label="High-quality follower quantity selector">
  <div className="litix-followers-nine-heading"><strong>High-Quality Followers</strong><span>100–20,000 maximum · actual service limits apply</span></div>
  <div className="litix-followers-nine-grid" role="group" aria-label="Choose follower amount">
   {PRESETS.map(amount=>{
    const active=!custom&&quantity===amount;
    const canSelect=eligible(amount)&&Boolean(cardFor(amount));
    return <button key={amount} type="button" className={"litix-followers-nine-tile"+(active?" active":"")}
     disabled={!canSelect} aria-pressed={active} title={!canSelect?"Not currently offered for this service":undefined}
     onClick={()=>{setCustom(false);onQuantityChange(amount);}}>
     {amount===1000&&<em>FEATURED</em>}
     <strong>{amount.toLocaleString("en-US")}</strong>
     <span>{canSelect?(savingsFor(amount)||"Starter"):"Unavailable"}</span>
    </button>;
   })}
   <button type="button" className={"litix-followers-nine-tile"+(custom?" active":"")}
    aria-pressed={custom} aria-expanded={custom} aria-controls="litix-followers-nine-custom"
    onClick={()=>setCustom(value=>!value)}>
    <strong>Custom</strong><span>100–20,000</span>
   </button>
  </div>
  {custom&&<div id="litix-followers-nine-custom" className="litix-followers-nine-custom">
   <label htmlFor="litix-followers-nine-quantity">Custom followers quantity</label>
   <input id="litix-followers-nine-quantity" type="number" inputMode="numeric"
    min={Math.max(100,min)} max={max} step={Number(product?.unitStep||1)}
    value={quantity||""} aria-invalid={!eligible(quantity)}
    onChange={event=>onQuantityChange(event.target.value===""?0:Number(event.target.value))}/>
   {!eligible(quantity)&&<p role="alert">Enter a supported quantity between {Math.max(100,min).toLocaleString("en-US")} and {max.toLocaleString("en-US")}.</p>}
  </div>}
  <div className="litix-followers-nine-total" aria-live="polite">
   {Number.isSafeInteger(quotedCents)&&quotedCents>=100?<div><sup>$</sup><strong>{(quotedCents/100).toFixed(2)}</strong></div>:
    <strong className="litix-followers-nine-pending">{quotePending?"Verifying current USD price…":"Choose an available amount"}</strong>}
   {Number.isSafeInteger(quotedCents)&&quotedCents>=100&&hundred&&quantity>100&&
     <p>{(()=>{const base=Math.round(hundred.totalCents*quantity/100),saving=Math.max(0,base-quotedCents);
       return saving>0?"You Save "+money(saving)+" ("+Math.round(saving/base*100)+"% Off)":""})()}</p>}
   <small>Actual Litix service rates. Secure checkout re-verifies your total before any payment.</small>
  </div>
  <button type="button" className="litix-followers-nine-buy"
   disabled={!eligible(quantity)||!Number.isSafeInteger(quotedCents)||quotedCents<100||quotePending}
   onClick={continueOrder}>Buy Now · Review PayKings Checkout</button>
 </div>;
}
