"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
const fmt=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents||0)/100);
const normal=x=>String(x||"").toLowerCase().trim();
const qtyTypes=new Set(["default","seo","comment likes","mentions custom list","mentions hashtag","mentions user followers","poll"]);
const label=(name,children)=><label className="lgc-order-field" key={name}><span>{name}</span>{children}</label>;
const int=(data,name,set,min,max)=><input type="number" min={min} max={max} step="1" value={data[name]??""} onChange={e=>set(name,e.target.value)} aria-label={name}/>;
export default function GlobalOrderWizard({catalog,selected,onSelect,platform,category,onCategoryChange}){
 const [values,setValues]=useState({}),[quote,setQuote]=useState(null),[error,setError]=useState(""),[checking,setChecking]=useState(false);
 const options=catalog?.choices||[],matched=options.find(x=>x.id===selected?.id);
 const service=matched||selected||null;
 const set=(key,value)=>setValues(old=>({...old,[key]:value}));
 useEffect(()=>{setValues(service?{quantity:String(service.supplierMinimum??service.minimum??1),min:String(service.minimum??service.supplierMinimum??1),max:String(service.maximum??service.supplierMaximum??1000),posts:"5",delay:"60",runs:"2",interval:"30",answer_number:"1"}:{});setQuote(null);setError("")},[service?.id]);
 const t=normal(service?.type),minimum=Number(service?.minimum??service?.supplierMinimum??1),maximum=Number(service?.maximum??service?.supplierMaximum??1000);
 const isSub=t==="subscriptions",isPackage=t==="package",isComments=t==="custom comments";
 const hasQty=qtyTypes.has(t);
 const totalRuns=values.dripfeedEnabled?Number(values.runs||0):1;
 const categoryOptions=catalog?.categories||[];
 const selectedId=service?.id||"";
 const requestPayload={...values};
 if(!values.dripfeedEnabled){delete requestPayload.runs;delete requestPayload.interval;}
 if(values.expiry){const [year,month,day]=values.expiry.split("-");requestPayload.expiry=[day,month,year].join("/");}
 const signature=JSON.stringify({id:selectedId,input:requestPayload});
 useEffect(()=>{
  if(!selectedId)return;
  const input=JSON.parse(signature).input;
  if((isSub&&!input.username)||(!isSub&&!input.link))return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   setChecking(true);
   fetch("/api/catalog/global/quote",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:selectedId,input}),signal:controller.signal})
    .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"quote_unavailable");return j})
    .then(j=>{setQuote(j);setError("");setChecking(false)})
    .catch(e=>{if(e.name!=="AbortError"){setError("Could not verify this service right now. No charge attempted.");setQuote(null);setChecking(false)}});
  },700);
  return()=>{clearTimeout(timer);controller.abort()};
 },[signature,isSub,selectedId]);
 const changeService=e=>onSelect(options.find(s=>s.id===e.target.value)||null);
 return <section id="lgc-order-wizard" className="lgc-order-wizard" aria-label="Choose service and order details">
  <header className="lgc-order-heading"><span className="lgc-eyebrow">02 / SELECT SERVICE</span><h2>Choose category and service</h2></header>
  <div className="lgc-order-selects">
   {label("Category",<select aria-label="Choose category" value={category} onChange={e=>{onCategoryChange(e.target.value);onSelect(null)}}>
    <option value="">All categories{platform?" · "+platform:""}</option>
    {categoryOptions.map(c=><option key={c} value={c}>{c}</option>)}
   </select>)}
   {label("Service",<select aria-label="Choose service" value={selectedId} onChange={changeService}>
    <option value="">Select a service</option>
    {options.map(o=><option key={o.id} value={o.id}>{o.name} · {o.type}</option>)}
   </select>)}
  </div>
  {catalog?.choicesTruncated&&<p className="lgc-muted">Showing up to 500 matching services. Select a platform or category to narrow your results.</p>}
  {service&&<div className="lgc-order-selected">
   <strong>{service.name}</strong>
   <p>{service.platform} · {service.type} · {service.category}</p>
   <span className="lgc-order-range">Supplier-supported quantity: {minimum.toLocaleString()}–{maximum.toLocaleString()}</span>
  </div>}
  {service&&<div className="lgc-order-detail">
   <div className="lgc-section-title"><span className="lgc-eyebrow">03 / ORDER DETAILS</span><h2>Enter your details</h2></div>
   <div className="lgc-order-fields">
    {isSub?<>
     {label("Username",<input autoComplete="off" value={values.username||""} placeholder="@username" onChange={e=>set("username",e.target.value)}/>)}
     {label("Minimum per post",int(values,"min",set,minimum,maximum))}
     {label("Maximum per post",int(values,"max",set,minimum,maximum))}
     {label("Future posts limit",int(values,"posts",set,1,10000))}
     {label("Existing posts (optional)",int(values,"old_posts",set,0,10000))}
     {label("Delay (minutes)",<select value={values.delay||"60"} onChange={e=>set("delay",e.target.value)}>{[0,5,10,15,20,30,40,50,60,90,120,150,180,210,240,270,300,360,420,480,540,600].map(x=><option key={x} value={x}>{x}</option>)}</select>)}
     {label("End date (optional)",<input type="date" value={values.expiry||""} onChange={e=>set("expiry",e.target.value)}/>)}
    </>:<>
     {label("Public link / profile URL",<input value={values.link||""} placeholder="https://www.instagram.com/..." onChange={e=>set("link",e.target.value)}/>)}
     {hasQty&&label("Quantity",int(values,"quantity",set,minimum,maximum))}
     {isComments&&label("Custom comments (one per line)",<textarea rows={4} value={values.comments||""} onChange={e=>set("comments",e.target.value)} placeholder={"Great post!\nNice video!"}/>)}
     {["mentions custom list","mentions"].includes(t)&&label("Usernames (one per line)",<textarea rows={4} value={values.usernames||""} onChange={e=>set("usernames",e.target.value)}/>)}
     {t==="mentions hashtag"&&label("Hashtag",<input value={values.hashtag||""} placeholder="#yourbrand" onChange={e=>set("hashtag",e.target.value)}/>)}
     {t==="comment likes"&&label("Comment owner username",<input value={values.username||""} placeholder="@username" onChange={e=>set("username",e.target.value)}/>)}
     {t==="mentions user followers"&&label("Follower source profile URL",<input type="url" value={values.username||""} placeholder="https://www.instagram.com/creator/" onChange={e=>set("username",e.target.value)}/>)}
     {t==="seo"&&label("SEO keywords (one per line)",<textarea rows={4} value={values.keywords||""} onChange={e=>set("keywords",e.target.value)} placeholder={"creator marketing\nsocial media services"}/>)}
     {t==="poll"&&label("Poll answer number",int(values,"answer_number",set,1,100))}
     {service.dripfeed&&t==="default"&&<>
      <label className="lgc-order-checkbox"><input type="checkbox" checked={!!values.dripfeedEnabled} onChange={e=>set("dripfeedEnabled",e.target.checked)}/> Schedule delivery in runs</label>
      {values.dripfeedEnabled&&<>{label("Number of runs",int(values,"runs",set,2,100))}{label("Minutes between runs",int(values,"interval",set,1,10080))}<p className="lgc-muted">Total units: {(Number(values.quantity||0)*totalRuns).toLocaleString()}. The total charge includes every run.</p></>}
     </>}
    </>}
   </div>
  </div>}
  {service&&<section className="lgc-order-confirm" aria-label="Review service quote">
    <span className="lgc-eyebrow">04 / REVIEW AND CHECKOUT</span>
    <h2>Review your order</h2>
    {checking&&<p role="status" className="lgc-muted">Verifying live service rate and order requirements…</p>}
    {error&&<p role="alert" className="lgc-error">{error}</p>}
    {quote?.customerAmountCents!=null&&<div className="lgc-order-total">{fmt(quote.customerAmountCents)}</div>}
    <div className="lgc-order-summary">
     <span>Service</span><strong>{service.name}</strong>
     <span>Order type</span><strong>{service.type}</strong>
     {hasQty&&<><span>Quantity</span><strong>{Number(values.quantity||0).toLocaleString()}</strong></>}
     {quote?.retailPer1000Cents!=null&&<><span>Retail rate</span><strong>{fmt(quote.retailPer1000Cents)} / 1,000</strong></>}
    </div>
    {quote?.smallestEligibleQuantity&&<p className="lgc-order-warning">Minimum $5 order: enter at least {quote.smallestEligibleQuantity.toLocaleString()} units.</p>}
    {quote?.reason&&quote.reason!=="approved_live_purchase"&&<p className="lgc-order-warning">{quote.reason.replace(/_/g," ")}. This service isn't currently enabled for checkout.</p>}
    {quote?.canPurchase&&quote?.validInput&&quote?.checkoutPath?
      <><Link href={quote.checkoutPath} className="lgc-checkout-link">Continue to secure Litix checkout</Link><p className="lgc-muted">Select this same service in the existing secure checkout. No payment has been initiated here.</p></>:
      <button type="button" className="lgc-checkout-disabled" disabled aria-label="Checkout unavailable for this service">Checkout not yet available for this service</button>}
    <p className="lgc-order-safety">No supplier purchase or payment is triggered by reviewing a quote.</p>
   </section>}
 </section>;
}
