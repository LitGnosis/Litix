"use client";
import {useEffect,useMemo,useRef,useState} from "react";
const money=amount=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(amount||0)/100);
const dollars=amount=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:5}).format(Number(amount||0));
const dataCall=async(body)=>{
 const r=await fetch("/api/owner/wholesale",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify(body)});
 const v=await r.json();if(!r.ok&&r.status!==202)throw Error(v.error||"Request unavailable");return v;
};
export default function OwnerWholesaleUI(){
 const [data,setData]=useState({services:[],providers:[]});
 const [balances,setBalances]=useState([]);
 const [tab,setTab]=useState("catalog");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState("");
 const [method,setMethod]=useState("supplier_balance"),[selected,setSelected]=useState(null);
 const [filters,setFilters]=useState({query:"",provider:"all",speed:false,lowDrop:false,refill:"any"});
 const [profile,setProfile]=useState(""),[quantity,setQuantity]=useState(1000),[originalFollowers,setOriginalFollowers]=useState("");
 const [quote,setQuote]=useState(null),[confirmed,setConfirmed]=useState(false),[idempotency,setIdempotency]=useState("");
 const [orders,setOrders]=useState([]),[purchaseResult,setPurchaseResult]=useState(null);
 const [cardReady,setCardReady]=useState(false),[collectToken,setCollectToken]=useState(null);
 const doneRef=useRef(null);
 const chosen=useMemo(()=>data.services.find(x=>x.provider===selected?.provider&&x.id===selected?.id),[data.services,selected]);
 useEffect(()=>{setIdempotency(crypto.randomUUID());reload()},[]);
 async function reload(){
  setLoading(true);setNotice("");
  try{
   const r=await fetch("/api/owner/wholesale?view=catalog",{cache:"no-store",credentials:"same-origin"});
   if(!r.ok)throw Error("Owner authentication or supplier availability unavailable");
   setData(await r.json());
   const balancesResponse=await fetch("/api/owner/wholesale?view=balances",{cache:"no-store",credentials:"same-origin"});
   if(balancesResponse.ok)setBalances((await balancesResponse.json()).balances||[]);
  }catch(e){setNotice(e.message)}finally{setLoading(false)}
 }
 async function loadOrders(){
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/owner/wholesale?view=orders",{cache:"no-store",credentials:"same-origin"});
   if(!r.ok)throw Error("Order list unavailable");setOrders((await r.json()).orders||[]);
  }catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 const visible=useMemo(()=>data.services.filter(s=>{
  const q=filters.query.toLowerCase();
  if(filters.provider!=="all"&&s.provider!==filters.provider)return false;
  if(q&&![s.name,s.id,s.category].some(v=>String(v).toLowerCase().includes(q)))return false;
  if(filters.speed&&!/fast|instant|hour|\/hr|\/day|start/i.test(s.advertisedSpeed))return false;
  if(filters.lowDrop&&!s.lowDropClaim)return false;
  if(filters.refill!=="any"&&(filters.refill==="api"?!s.refillEligible:!s.refillAdvertised||Number(s.refillDays||0)<Number(filters.refill)))return false;
  return true;
 }).sort((a,b)=>a.pricePer1000-b.pricePer1000),[data.services,filters]);
 function select(s){setSelected({provider:s.provider,id:s.id});setQuantity(Math.max(1000,s.min));setQuote(null);setConfirmed(false);setPurchaseResult(null);setCollectToken(null);
  document.getElementById("owner-purchase")?.scrollIntoView({behavior:"smooth",block:"start"});}
 async function review(e){
  e.preventDefault();if(!chosen)return;setBusy(true);setNotice("");setQuote(null);setConfirmed(false);
  try{const r=await dataCall({action:"quote",provider:chosen.provider,serviceId:chosen.id,quantity:Number(quantity),
   profile,paymentMethod:method});setQuote(r.quote);setIdempotency(crypto.randomUUID());}
  catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 async function purchase(token){
  if(!quote||!confirmed||busy||!data.purchasesEnabled)return;
  setBusy(true);setNotice("");setPurchaseResult(null);
  try{
   const result=await dataCall({action:"purchase",provider:quote.provider,serviceId:quote.serviceId,
    quantity:quote.quantity,profile:quote.destination,paymentMethod:method,
    originalFollowers:originalFollowers===""?null:Number(originalFollowers),
    expectedWholesaleCents:quote.wholesaleCents,expectedTotalCents:quote.totalCents,
    idempotencyKey:idempotency,confirmed:true,paymentToken:token||null});
   setPurchaseResult(result);
   setQuote(null);setConfirmed(false);setCollectToken(null);
   if(result.orderId)await loadOrders();
  }catch(e){setNotice(e.message+" — do not repeat an uncertain request without checking order history.")}
  finally{setBusy(false)}
 }
 doneRef.current=purchase;
 useEffect(()=>{
  if(method!=="paykings"||!data.cardEnabled||!data.cardPublicKey||!quote)return;
  let active=true,script=document.getElementById("owner-collectjs"),interval;
  setCardReady(false);
  function setup(){
   if(!active||!window.CollectJS?.configure)return;
   try{window.CollectJS.configure({
    variant:"inline",styleSniffer:false,
    fields:{ccnumber:{selector:"#ccnumber",title:"Card number",placeholder:"Card number"},
      ccexp:{selector:"#ccexp",title:"Expiry",placeholder:"MM / YY"},
      cvv:{selector:"#cvv",title:"Security code",placeholder:"CVV"}},
    callback:result=>{if(active&&result?.token)doneRef.current?.(result.token)},
    fieldsAvailableCallback:()=>{if(active)setCardReady(true)}
   });}catch{setNotice("Tokenized owner payment fields unavailable. No payment submitted.")}
  }
  if(!script){
   script=document.createElement("script");script.id="owner-collectjs";
   script.src="https://secure.nmi.com/token/Collect.js";
   script.setAttribute("data-tokenization-key",data.cardPublicKey);
   script.setAttribute("data-variant","inline");
   script.setAttribute("data-field-ccnumber-selector","#ccnumber");
   script.setAttribute("data-field-ccexp-selector","#ccexp");
   script.setAttribute("data-field-cvv-selector","#cvv");
   document.head.appendChild(script);
  }
  interval=window.setInterval(()=>{if(window.CollectJS?.configure){clearInterval(interval);setup()}},150);
  return()=>{active=false;clearInterval(interval)};
 },[method,data.cardEnabled,data.cardPublicKey,quote]);
 function finalOrder(e){
  e.preventDefault();
  if(method==="paykings"){
   if(!cardReady||!data.cardEnabled||!window.CollectJS?.startPaymentRequest){setNotice("Secure gateway is not ready. No payment submitted.");return}
   try{window.CollectJS.startPaymentRequest()}catch{setNotice("Secure tokenization failed. No payment submitted.")}
  }else purchase("");
 }
 async function refreshOrder(id){
  setBusy(true);setNotice("");
  try{
   const r=await dataCall({action:"refresh",orderId:id});
   setOrders(existing=>existing.map(o=>o.id===id?r.order:o));
  }catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 async function verifySettlement(id){
  setBusy(true);setNotice("");
  try{
   const result=await dataCall({action:"verifySettlement",orderId:id});
   setNotice(result.payment==="settled"?
    "PayKings settlement verified; supplier dispatch "+(result.submitted?"submitted":"requires review") :
    "PayKings settlement remains unverified. No supplier request was sent.");
   await loadOrders();
  }catch(e){setNotice(e.message)}finally{setBusy(false)}
 }
 return <main className="owner-wholesale">
  <header className="owner-header"><div><span className="owner-small">LITIX · CONFIDENTIAL</span><h1>Owner Wholesale Desk</h1><p>Authenticated owner access · supplier rates never appear in the public store.</p></div>
   <form method="post" action="/owner/wholesale/logout"><button type="submit" className="owner-outline">Sign out</button></form></header>
  <nav className="owner-tabs" aria-label="Owner sections">
   <button type="button" aria-pressed={tab==="catalog"} onClick={()=>setTab("catalog")}>Wholesale services</button>
   <button type="button" aria-pressed={tab==="orders"} onClick={()=>{setTab("orders");loadOrders()}}>Owner order tracking</button>
  </nav>
  {notice&&<div role="alert" className="owner-notice">{notice}</div>}
  {!data.purchasesEnabled&&<div className="owner-notice">Wholesale comparison is available after owner sign-in. Real purchases are currently disabled until verified Auth0 setup, database deployment and security sign-off.</div>}
  {tab==="catalog"?<>
   <section className="owner-summary" aria-label="Supplier availability">
    {(data.providers||[]).map(p=>{
     const balance=balances.find(x=>x.provider===p.name);
     return <div key={p.name}><strong>{p.name.toUpperCase()}</strong>
      <span>Catalog: {p.status} · Wallet: {balance?.status==="available"?dollars(balance.amount)+" "+balance.currency:"Unavailable"}</span></div>
    })}
    <div><strong>{data.services.length.toLocaleString()}</strong><span>Instagram follower services, actual supplier-listed rates</span></div>
   </section>
   <section className="owner-panel">
    <h2>Compare supplier wholesale</h2>
    <div className="owner-filters">
     <label>Find service<input placeholder="ID, speed, name…" value={filters.query} onChange={e=>setFilters(f=>({...f,query:e.target.value}))}/></label>
     <label>Supplier<select value={filters.provider} onChange={e=>setFilters(f=>({...f,provider:e.target.value}))}>
      <option value="all">Both suppliers</option><option value="boostero">Boostero</option><option value="smmglob">SMMGLOB</option></select></label>
     <label>Refill<select value={filters.refill} onChange={e=>setFilters(f=>({...f,refill:e.target.value}))}>
      <option value="any">All refill types</option><option value="api">API refill eligible</option><option value="30">30+ days advertised</option>
      <option value="60">60+ days advertised</option><option value="90">90+ days advertised</option><option value="365">365+ days advertised</option></select></label>
     <label className="owner-check"><input type="checkbox" checked={filters.speed} onChange={e=>setFilters(f=>({...f,speed:e.target.checked}))}/>Fast delivery claims</label>
     <label className="owner-check"><input type="checkbox" checked={filters.lowDrop} onChange={e=>setFilters(f=>({...f,lowDrop:e.target.checked}))}/>Low-drop claims</label>
    </div>
    <p className="owner-help">{loading?"Loading authorized supplier catalogs…":visible.length+" matching services · USD wholesale per 1,000 · delivery and refill claims are supplier-advertised, not guarantees."}</p>
    <div className="owner-table-scroll"><table><thead><tr><th>Supplier / service</th><th>Wholesale / 1k</th><th>Min–max</th><th>Speed claim</th><th>Refill</th><th>Action</th></tr></thead>
     <tbody>{visible.map(s=><tr key={s.provider+":"+s.id}><td><b>{s.provider.toUpperCase()} #{s.id}</b><div>{s.name}</div></td>
      <td><strong>{dollars(s.pricePer1000)}</strong></td><td>{s.min.toLocaleString()}–{s.max.toLocaleString()}</td>
      <td>{s.advertisedSpeed}</td><td>{s.refillDays?s.refillDays+"d advertised":"Not advertised"}<div>{s.refillMethod}</div></td>
      <td><button type="button" className="owner-primary" onClick={()=>select(s)}>Choose</button></td></tr>)}</tbody></table></div>
   </section>
   <section className="owner-panel" id="owner-purchase">
    <h2>Private wholesale purchase</h2>
    {!chosen?<p>Select an Instagram follower service above to prepare a wholesale quote. No funds will be spent without final confirmation.</p>:<>
     <p><strong>{chosen.provider.toUpperCase()} #{chosen.id}</strong> · {chosen.name}</p>
     <form className="owner-order-form" onSubmit={review}>
      <label>Instagram username or profile<input value={profile} onChange={e=>{setProfile(e.target.value);setQuote(null)}} placeholder="@youraccount" autoCapitalize="none" required/></label>
      <label>Followers<input type="number" min={chosen.min} max={chosen.max} step="1" value={quantity} onChange={e=>{setQuantity(Number(e.target.value));setQuote(null)}} required/></label>
      <label>Original follower count (optional, manually recorded)<input type="number" min={0} value={originalFollowers} onChange={e=>setOriginalFollowers(e.target.value)} placeholder="Not independently verified"/></label>
      <fieldset><legend>Purchase method</legend>
       <label className="owner-check"><input type="radio" name="owner-method" value="supplier_balance" checked={method==="supplier_balance"} onChange={()=>{setMethod("supplier_balance");setQuote(null)}}/>Direct prepaid supplier balance (no PayKings charge)</label>
       <label className="owner-check"><input type="radio" name="owner-method" value="paykings" checked={method==="paykings"} onChange={()=>{setMethod("paykings");setQuote(null)}} disabled={!data.cardEnabled}/>Real PayKings charge (fee disclosure required) {!data.cardEnabled&&"— unavailable pending verified fees and gateway testing"}</label>
      </fieldset>
      <button className="owner-primary" disabled={busy||!profile||loading}>Check current wholesale quote</button>
     </form>
     {quote&&<div className="owner-review">
      <h3>Final owner confirmation</h3>
      <dl><dt>Supplier</dt><dd>{quote.provider.toUpperCase()} #{quote.serviceId}</dd>
       <dt>Instagram profile</dt><dd>{quote.destination}</dd><dt>Quantity</dt><dd>{quote.quantity.toLocaleString()}</dd>
       <dt>Supplier charge</dt><dd><strong>{money(quote.wholesaleCents)}</strong></dd>
       <dt>Gateway processing surcharge</dt><dd>{money(quote.feeCents)}</dd>
       <dt>Owner payment total</dt><dd><strong>{money(quote.totalCents)}</strong></dd>
       <dt>Payment method</dt><dd>{method==="supplier_balance"?"Supplier wallet — no card charge":"Real PayKings tokenized card payment"}</dd></dl>
      <label className="owner-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
       I authorize exactly one real order for this profile and amount. No automatic retries if supplier outcome is uncertain.</label>
      {method==="paykings"&&data.cardEnabled&&<div className="owner-cards" aria-label="Secure PayKings hosted card fields">
       <label>Card number <div id="ccnumber" className="owner-card-field"/></label>
       <label>Expiration <div id="ccexp" className="owner-card-field"/></label>
       <label>Security code <div id="cvv" className="owner-card-field"/></label>
      </div>}
      <button type="button" className="owner-primary owner-submit" disabled={!data.purchasesEnabled||busy||!confirmed||(method==="paykings"&&!cardReady)} onClick={finalOrder}>
       {busy?"Processing once…":method==="supplier_balance"?"Authorize one supplier-wallet order":"Authorize PayKings payment and supplier order"}</button>
      {!data.purchasesEnabled&&<p className="owner-help">Purchase submission is locked. Your current quote is not an order.</p>}
     </div>}
    </>}
    {purchaseResult&&<div className="owner-notice" role="status"><strong>Order {purchaseResult.orderId}</strong> · {purchaseResult.state||purchaseResult.payment} · Supplier ID: {purchaseResult.supplierOrderId||"Unconfirmed"}.
     Supplier acceptance is not verified delivery.</div>}
   </section>
  </>:<section className="owner-panel">
   <div className="owner-panel-head"><h2>Wholesale order tracking</h2><button className="owner-outline" onClick={loadOrders} disabled={busy}>Refresh list</button></div>
   {!orders.length?<p>No owner wholesale orders have been recorded in this ledger.</p>:<div className="owner-table-scroll"><table><thead>
    <tr><th>Order / supplier</th><th>Destination</th><th>Supplier ID</th><th>Cost / quantity</th><th>Status</th><th>Follower progress</th><th>Action</th></tr>
   </thead><tbody>{orders.map(o=><tr key={o.id}>
    <td><b>{o.provider?.toUpperCase()} #{o.supplier_service_id}</b><div>{o.id}</div><div>{o.payment_method}</div></td>
    <td>{o.destination}</td><td>{o.supplier_order_id||"Unconfirmed"}</td>
    <td>{money(o.supplier_cost_cents)}<div>{Number(o.quantity).toLocaleString()} ordered</div></td>
    <td>{o.state}<div>Payment: {o.payment_state}{o.settlement_state==="pending"?" · awaiting settlement":""}</div><div>{o.supplier_status?.status||"No verified delivery update"}</div></td>
    <td>Original (self-recorded): {o.baseline_followers??"Not provided"}
     <div>Supplier-reported completed: {o.supplier_status?.completed??"Unknown"}</div>
     <div>Supplier-reported remaining: {o.supplier_status?.remains??"Unknown"}</div>
     <div>Refill at purchase: {o.refill_days?o.refill_days+" days":"Unspecified"} · API refill: {o.refill_eligible?"eligible":"not confirmed"} · {o.refill_method||"not advertised"}</div></td>
    <td>{o.payment_method==="paykings"&&o.settlement_state==="pending"?
    <button type="button" className="owner-outline" disabled={busy||!data.cardEnabled} onClick={()=>verifySettlement(o.id)}>Verify settlement</button>:
    <button type="button" className="owner-outline" disabled={busy} onClick={()=>refreshOrder(o.id)}>Check supplier</button>}</td></tr>)}</tbody></table></div>}
  </section>}
  <footer className="owner-footer"><span>Private owner dashboard · no public retail changes</span><button type="button" onClick={reload} className="owner-outline">Refresh wholesale rates</button></footer>
 </main>;
}
