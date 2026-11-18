"use client";
export default function LitixMobileCheckoutBar({service,quantity,amountCents,busy}){
 if(!service)return null;
 const value=Number.isSafeInteger(amountCents)&&amountCents>=100
  ?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(amountCents/100)
  :"Verify price";
 function continueToCheckout(){
  const card=document.querySelector("#checkout .premium-inline-checkout")||document.getElementById("checkout");
  if(!card)return;
  card.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});
 }
 return <aside className="litix-mobile-checkout-bar" aria-label="Your order summary">
  <div className="litix-mobile-summary"><strong>{service}</strong><small>{Number(quantity||0).toLocaleString("en-US")} units · {value}</small></div>
  <button type="button" disabled={busy} onClick={continueToCheckout}>Continue to Checkout</button>
 </aside>;
}
