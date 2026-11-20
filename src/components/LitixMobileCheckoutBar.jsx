"use client";
import {useEffect,useState} from "react";
export default function LitixMobileCheckoutBar({service,quantity,amountCents,busy}){
 const [checkoutButtonVisible,setCheckoutButtonVisible]=useState(false);
 useEffect(()=>{
  const button=document.querySelector("#checkout .premium-pay-button")||document.getElementById("checkout");
  if(!button||typeof IntersectionObserver==="undefined")return;
  const observer=new IntersectionObserver(entries=>setCheckoutButtonVisible(entries.some(entry=>entry.isIntersecting)),{threshold:0.1});
  observer.observe(button);
  return()=>observer.disconnect();
 },[]);
 if(!service||checkoutButtonVisible)return null;
 const count=Number(quantity||0).toLocaleString("en-US");
 const amount=Number.isSafeInteger(amountCents)&&amountCents>=100
  ?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(amountCents/100)
  :"Verify price";
 function continueToCheckout(){
  const card=document.querySelector("#checkout .premium-pay-button")||document.getElementById("checkout");
  if(!card)return;
  card.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
 }
 return <aside className="litix-mobile-checkout-bar" aria-label="Your order summary">
  <div className="litix-mobile-summary">
   <strong>{service}<span aria-hidden="true"> · </span>{count} units</strong>
   <small aria-live="polite">{amount} · Final total verified at checkout</small>
  </div>
  <button type="button" disabled={busy} onClick={continueToCheckout}>Review checkout</button>
 </aside>;
}
