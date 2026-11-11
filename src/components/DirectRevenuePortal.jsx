"use client";
import {useEffect,useMemo,useState} from "react";
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
const tiers={
 PANEL_149_WK:{title:"White-label child panel",price:149,limit:0,caption:"Wholesale access and branded panel license"},
 AGENCY_500_WK:{title:"Agency Content Operations",price:500,limit:25,caption:"25 authorized handles, creative operations and monitored content"},
 ENTERPRISE_1500_WK:{title:"Enterprise Content Operations",price:1500,limit:100,caption:"Up to 100 authorized handles and higher-touch content operations"}
};
export default function DirectRevenuePortal({mode}){
 const wholesale=mode==="wholesale";
 const [tier,setTier]=useState(wholesale?"PANEL_149_WK":"AGENCY_500_WK");
 const [base,setBase]=useState("6.00"),[markup,setMarkup]=useState(60),[volume,setVolume]=useState(25);
 const [email,setEmail]=useState(""),[name,setName]=useState(""),[domain,setDomain]=useState("");
 const [consent,setConsent]=useState(false),[handles,setHandles]=useState("");
 const [processing,setProcessing]=useState(false),[msg,setMsg]=useState(""),[submitted,setSubmitted]=useState("");
 const [checkout,setCheckout]=useState(false);
 useEffect(()=>{let active=true;fetch("/api/direct-plans/catalog",{cache:"no-store"}).then(r=>r.json()).then(x=>{if(active)setCheckout(x.checkoutEnabled===true)}).catch(()=>{});return()=>{active=false}},[]);
 const tierInfo=tiers[tier],cost=Number(base)||0,retail=cost*(1+markup/100),profit=Math.max(0,retail-cost);
 const weekly=useMemo(()=>retail*volume,[retail,volume]);
 const selectedHandles=handles.split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean);
 async function register(e){
  e.preventDefault();setProcessing(true);setMsg("");setSubmitted("");
  if(!consent){setMsg("Confirm that you control the domain or have authorization from the account owners.");setProcessing(false);return}
  if(!wholesale&&(selectedHandles.length>tierInfo.limit || selectedHandles.length!==new Set(selectedHandles).size)){
   setMsg("Select up to "+tierInfo.limit+" unique authorized handles.");setProcessing(false);return
  }
  try{
   const r=await fetch("/api/direct-plans/apply",{method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({tier,owner_email:email,agency_name:wholesale?null:name,
       custom_domain:wholesale?domain:null}),cache:"no-store"});
   const x=await r.json();if(!r.ok)throw Error(x.error||"applications_unavailable");
   setSubmitted(x.application_id);setMsg("Application recorded. No charge was made.");
  }catch(err){setMsg(err.message==="applications_not_yet_enabled"?
    "Enrollment service is being connected. No payment was taken.":err.message)}
  finally{setProcessing(false)}
 }
 async function pay(){
  if(!submitted){setMsg("Submit your application before checkout.");return}
  setProcessing(true);
  try{
   const r=await fetch("/api/direct-plans/start",{method:"POST",
    headers:{"content-type":"application/json"},body:JSON.stringify({tier,application_id:submitted})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"gateway_not_ready");
   const url=new URL(data.url);if(url.protocol!=="https:"||!["secure.nmi.com","secure.prep.nmi.com"].includes(url.hostname))
      throw Error("invalid_payment_destination");
   window.location.assign(url.toString());
  }catch(err){setMsg(err.message==="paykings_recurring_not_activated"?
   "Recurring PayKings checkout is locked until payment and fulfillment verification passes.":err.message)}
  finally{setProcessing(false)}
 }
 return <section className="portal">
  <article className="panel">
   <p className="overline">01 / {wholesale?"WHOLESALE PROFIT MODEL":"RETAINER PLAN"}</p>
   <h2>{wholesale?"Plan your reseller margins":"Choose your agency tier"}</h2>
   {wholesale?<><p>The calculator models your proposed rate, not a guaranteed wholesale cost or current Litix rate card.</p>
    <label>Illustrative cost per 1,000 (USD)<input type="number" min="0" max="9999" step=".01" value={base} onChange={e=>setBase(e.target.value)}/></label>
    <label>Markup above cost: {markup}%<input type="range" min="0" max="300" value={markup} onChange={e=>setMarkup(Number(e.target.value))}/></label>
    <label>Illustrative weekly units (1,000 each)<input type="number" min="0" max="100000" value={volume} onChange={e=>setVolume(Math.max(0,Math.min(100000,Number(e.target.value)||0)))}/></label>
    <p className="money">{money(retail)} <small>illustrative retail per 1,000</small></p>
    <div className="alert">Potential gross spread: <strong>{money(profit)} per 1,000</strong>.
      Weekly modeled revenue: <strong>{money(weekly)}</strong>, before licensing, delivery, processing and commissions.</div>
    <p className="muted">No supplier API or engagement quantity is implied by these example numbers.</p></>:<>
      <p>These are proposals for **legitimate first-party content work** and owner-authorized post observations. Unlimited likes, views and streams are not sold.</p>
      <div className="tier-list">{["AGENCY_500_WK","ENTERPRISE_1500_WK"].map(k=><button type="button" className="tier" key={k} aria-pressed={tier===k} onClick={()=>{setTier(k);setMsg("")}}>
       <strong>{tiers[k].title} — {money(tiers[k].price)}/week</strong>
       <span>{tiers[k].limit} monitored handles · {tiers[k].caption}</span></button>)}</div>
      <label>Authorized profiles (separate with commas or spaces)<textarea rows={5}
        placeholder="@yourbrand @anotherbrand" value={handles} onChange={e=>setHandles(e.target.value)}/></label>
      <p className="muted">{selectedHandles.length} of {tierInfo.limit} handle slots specified. Handles are not sent for monitoring until authorization is verified.</p>
    </>}
  </article>
  <article className="panel">
   <p className="overline">02 / LICENSE AND ENROLLMENT</p><h2>{tierInfo.title}</h2>
   <p className="money">{money(tierInfo.price)} <small>per week, when activated</small></p>
   <p>{tierInfo.caption}. Recurring charges require approved merchant plans and settlement verification.</p>
   <form onSubmit={register}>
    {wholesale?<label>Desired white-label domain<input required type="text" maxLength={254} value={domain}
       placeholder="yourbrand.example" onChange={e=>setDomain(e.target.value)}/></label>:
     <label>Agency name<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label>}
    <label>Business email<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label><input type="checkbox" style={{width:18,marginRight:8}} checked={consent} onChange={e=>setConsent(e.target.checked)}/>
     I control my domain and/or am authorized to manage the listed profiles.</label>
    <button type="submit" disabled={processing} className="btn">{processing?"Processing…":"Apply for "+tierInfo.title}</button>
   </form>
   {msg&&<p className={submitted?"result":"error"} role="status">{msg}</p>}
   <button type="button" disabled={!checkout||!submitted||processing} className="btn" onClick={pay}>
     {checkout?"Continue to secure PayKings checkout":"PayKings recurring checkout — verification required"}
   </button>
   <p className="muted">Application submission is not a charge. A successful gateway authorization is not settlement. Keys, recurring commissions and orders activate only after verified settlement and owned-node capacity checks.</p>
  </article>
 </section>;
}
