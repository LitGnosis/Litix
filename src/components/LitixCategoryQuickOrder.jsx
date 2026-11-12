"use client";
import {useEffect,useMemo,useState} from "react";

const formatMoney=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
const presets=[100,500,1000,2500,5000,10000];
const validCard=s=>s?.purchasable===true&&/^litix_\d{1,12}$/.test(String(s?.id||""))&&
  Number.isSafeInteger(Number(s.min))&&Number(s.min)>0&&
  Number.isSafeInteger(Number(s.max))&&Number(s.max)>=Number(s.min)&&
  Number.isFinite(Number(s.per1000))&&Number(s.per1000)>0;
const amountCents=(service,quantity)=>Math.ceil(Number(service?.per1000||0)*quantity/1000*100-1e-8);

/**
 * A small, fully public quote-preview UI. All actual payments and supplier
 * orders continue through the existing /#checkout flow. The server obtains
 * an independent live Boostero price and eligibility check before payment.
 */
export default function LitixCategoryQuickOrder({platform,kind}){
 const [items,setItems]=useState([]);
 const [selectedId,setSelectedId]=useState("");
 const [quantity,setQuantity]=useState(0);
 const [state,setState]=useState("loading");
 const [message,setMessage]=useState("");
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setState("loading");setMessage("");
  const params=new URLSearchParams({platform,kind,ready:"true",page:"1"});
  fetch("/api/catalog/global?"+params,{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Litix services are temporarily unavailable.");
    return data;
   })
   .then(data=>{
    if(controller.signal.aborted)return;
    const eligible=(Array.isArray(data.items)?data.items:[]).filter(s=>validCard(s)&&s.platform===platform&&s.kind===kind);
    setItems(eligible);
    const first=eligible[0];
    setSelectedId(first?.id||"");
    setQuantity(first?Number(first.min):0);
    setState("ready");
    if(!first)setMessage("No verified packages are available for this category right now. Browse the catalog or try again.");
   })
   .catch(error=>{
    if(controller.signal.aborted)return;
    setItems([]);setSelectedId("");setQuantity(0);setState("error");
    setMessage(error?.message||"Unable to load currently available services.");
   });
  return()=>controller.abort();
 },[platform,kind,retry]);
 const selected=useMemo(()=>items.find(s=>s.id===selectedId)||null,[items,selectedId]);
 const step=Number(selected?.unitStep)||1;
 const valid=selected&&Number.isSafeInteger(quantity)&&quantity>=Number(selected.min)&&
  quantity<=Number(selected.max)&&Number.isSafeInteger(step)&&step>0&&
  (quantity-Number(selected.min))%step===0;
 const total=valid?amountCents(selected,quantity):0;
 const canContinue=valid&&Number.isSafeInteger(total)&&total>=100;
 const link=canContinue?"/?service="+encodeURIComponent(selected.id)+"&quantity="+encodeURIComponent(quantity)+"#checkout":null;
 return <section className="panel" aria-labelledby="litix-category-fast-checkout-title">
  <div className="kicker">LITIX · QUICK ORDER</div>
  <h2 id="litix-category-fast-checkout-title">Choose a package and quantity</h2>
  <p>Find your price without navigating away. Enter your public profile or post link at secure checkout—no social password needed.</p>
  {state==="loading"&&<p role="status">Loading verified Litix packages…</p>}
  {state==="error"&&<p role="alert">{message}</p>}
  {state!=="loading"&&!items.length&&<div style={{display:"flex",flexWrap:"wrap",gap:12}}>
   <button type="button" className="alt" onClick={()=>setRetry(n=>n+1)}>Retry packages</button>
   <a className="alt" href="#all-litix-services">Browse full catalog</a>
  </div>}
  {selected&&<div style={{display:"grid",gap:14,maxWidth:680,marginTop:16}}>
   <label>Choose verified service
    <select aria-label={platform+" "+kind+" service package"} value={selectedId}
     onChange={e=>{
      const found=items.find(s=>s.id===e.target.value);
      if(!found)return;
      setSelectedId(found.id);setQuantity(Number(found.min));
     }}>
     {items.map(s=><option key={s.id} value={s.id}>
       {s.name} · {formatMoney(Math.ceil(Number(s.per1000)*100-1e-8))}/1,000
     </option>)}
    </select>
   </label>
   <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
    <span><strong>{formatMoney(Math.ceil(Number(selected.per1000)*100-1e-8))}</strong> per 1,000</span>
    <span className="small">Available quantity: {Number(selected.min).toLocaleString()}–{Number(selected.max).toLocaleString()}</span>
   </div>
   <label>Quantity
    <input type="number" inputMode="numeric" aria-label="Order quantity" min={selected.min} max={selected.max}
     step={step} value={quantity||""}
     onChange={e=>setQuantity(e.target.value===""?0:Number(e.target.value))}/>
   </label>
   <div role="group" aria-label="Quick quantity options" style={{display:"flex",flexWrap:"wrap",gap:8}}>
    {[...new Set([Number(selected.min),...presets])].filter(n=>n>=Number(selected.min)&&n<=Number(selected.max)&&(n-Number(selected.min))%step===0).slice(0,7).map(n=>
     <button type="button" className="alt" key={n} aria-pressed={quantity===n}
      onClick={()=>setQuantity(n)} style={{minWidth:64}}>{n.toLocaleString()}</button>)}
   </div>
   <div className="totalbox" aria-live="polite">
    <div className="small">Estimated total in USD</div>
    <strong style={{fontSize:26}}>{canContinue?formatMoney(total):"Enter a valid quantity"}</strong>
    <p className="small">Final price and active supplier availability are verified again before payment.</p>
   </div>
   {link?<a className="primary" href={link}
     style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"14px 20px",textDecoration:"none"}}>
     Continue to secure checkout
    </a>:<p role="alert" className="small">Choose an allowed quantity meeting the service minimum and $1 checkout minimum. No payment has been attempted.</p>}
   {kind==="likes"&&["Instagram","TikTok"].includes(platform)&&<a href="/custom-likes">Want likes on multiple posts? Choose Your Posts</a>}
  </div>}
  <p className="small muted" style={{marginTop:14}}>Packages shown here are publicly listed; supplier delivery speed and availability can change. No charge is made until you review and submit payment.</p>
 </section>;
}
