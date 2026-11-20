"use client";
import {useEffect,useMemo,useState} from "react";
const dollars=cents=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(cents||0)/100);
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n||0));
const safe=(s,n=140)=>String(s||"").slice(0,n);
export default function OwnerPortal(){
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[problem,setProblem]=useState("");
 const [query,setQuery]=useState(""),[supplier,setSupplier]=useState("all"),[refillOnly,setRefillOnly]=useState(false);
 const [sort,setSort]=useState("price"),[selected,setSelected]=useState(null),[quantity,setQuantity]=useState(100);
 const [target,setTarget]=useState(""),[quote,setQuote]=useState(null),[agree,setAgree]=useState(false);
 const [result,setResult]=useState(null),[status,setStatus]=useState(null);
 async function request(url,opts={}){
  const resp=await fetch(url,{cache:"no-store",credentials:"same-origin",...opts,
   headers:{"content-type":"application/json",...(opts.method?{"x-litix-owner-csrf":data?.csrf||""}:{}),...opts.headers}});
  const body=await resp.json().catch(()=>({error:"Connection unavailable"}));
  if(!resp.ok)throw Error(body.error||"Operation failed");
  return body;
 }
 async function reload(){
  setProblem("");
  try{setData(await request("/api/owner/portal?view=dashboard"))}
  catch(e){setProblem(safe(e.message));}
 }
 useEffect(()=>{reload()},[]);
 const products=useMemo(()=>{
  const all=(data?.providers||[]).flatMap(p=>p.connected?p.items:[]);
  const matching=all.filter(x=>{
   if(supplier!=="all"&&x.supplier!==supplier)return false;
   if(refillOnly&&!x.refillAdvertised)return false;
   const text=(x.name+" "+x.platform+" "+x.category+" "+x.kind).toLowerCase();
   return text.includes(query.toLowerCase().trim());
  });
  return matching.sort((a,b)=>sort==="price"?
   a.rateUSDPer1000-b.rateUSDPer1000:a.name.localeCompare(b.name));
 },[data,query,supplier,refillOnly,sort]);
 function choose(row){
  setSelected(row);setQuantity(Math.max(100,Number(row.min)));setTarget("");
  setQuote(null);setAgree(false);setResult(null);setProblem("");
 }
 async function price(){
  if(!selected||busy)return;
  setBusy(true);setProblem("");setQuote(null);setAgree(false);setResult(null);
  try{
   const q=await request("/api/owner/portal",{method:"POST",body:JSON.stringify({
    action:"quote",supplier:selected.supplier,serviceId:selected.id,quantity:Number(quantity),destination:target})});
   setQuote({...q,idempotencyKey:crypto.randomUUID()});
  }catch(e){setProblem(safe(e.message))}
  finally{setBusy(false)}
 }
 async function purchase(){
  if(!quote||!agree||busy||!data?.purchasesEnabled||Date.now()>quote.expires)return;
  setBusy(true);setProblem("");setResult(null);
  try{
   const out=await request("/api/owner/portal",{method:"POST",body:JSON.stringify({
    action:"purchase",quoteToken:quote.quoteToken,idempotencyKey:quote.idempotencyKey,
    confirmed:true,expectedWholesaleCents:quote.wholesaleCents})});
   setResult(out);setQuote(null);setAgree(false);
   await reload();
  }catch(e){setProblem(safe(e.message));setQuote(null);setAgree(false);}
  finally{setBusy(false)}
 }
 async function track(id){
  setBusy(true);setStatus(null);setProblem("");
  try{setStatus((await request("/api/owner/portal?view=track&id="+encodeURIComponent(id))).order)}
  catch(e){setProblem(safe(e.message))}
  finally{setBusy(false)}
 }
 async function logout(){
  try{await request("/owner/auth/logout",{method:"POST",body:"{}"});}catch{}
  location.assign("/owner");
 }
 return <div className="owner-content">
  <div className="owner-intro">
   <div><p className="owner-eyebrow">PRIVATE OWNER COMMAND CENTER</p>
    <h1>Wholesale access. No retail markup.</h1>
    <p>Compare available supplier services and confirm any wallet-funded order before submission.</p></div>
   <button type="button" className="owner-small" onClick={logout}>Sign out</button>
  </div>
  {problem&&<p className="owner-warning" role="alert">{problem}</p>}
  {!data&&<p role="status" className="owner-box">Checking owner session and supplier connections…</p>}
  {data&&<><div className="owner-status">
   <span className={data.purchasesEnabled?"owner-enabled":"owner-disabled"}>
    {data.purchasesEnabled?"Owner purchasing enabled":"Purchasing locked until security gates pass"}</span>
   <span>Secure owner session verified</span>
  </div>
  <section aria-label="Prepaid supplier wallets" className="owner-wallet-grid">
   {(data.providers||[]).map(p=><article key={p.supplier} className="owner-box">
    <div className="owner-row"><h2>{p.supplier==="boostero"?"Boostero":"SMMGLOB"}</h2>
      <span className={p.connected?"owner-connected":"owner-offline"}>{p.connected?"Connected":"Offline"}</span></div>
    <strong className="owner-wallet-amount">{p.connected?dollars(p.wallet.balanceCents):"Not verified"}</strong>
    <small>{p.connected?"Supplier prepaid wallet · USD":"Supplier connection not validated"}</small>
    <p>{p.connected?p.items.length+" eligible default services":safe(p.error)}</p>
   </article>)}
  </section>
  <section className="owner-box" aria-labelledby="owner-catalog-title">
   <div className="owner-row"><div><p className="owner-eyebrow">LIVE SUPPLIER PRICES</p>
    <h2 id="owner-catalog-title">Search & compare wholesale</h2></div>
    <button type="button" className="owner-small" disabled={busy} onClick={reload}>Refresh suppliers</button></div>
   <div className="owner-filters">
    <label>Search<input type="search" value={query} placeholder="Instagram followers, likes, views…" onChange={e=>setQuery(e.target.value)}/></label>
    <label>Supplier<select value={supplier} onChange={e=>setSupplier(e.target.value)}>
     <option value="all">Both suppliers</option><option value="boostero">Boostero</option><option value="smmglob">SMMGLOB</option></select></label>
    <label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}>
     <option value="price">Lowest wholesale rate</option><option value="name">Service name</option></select></label>
    <label className="owner-checkbox"><input type="checkbox" checked={refillOnly} onChange={e=>setRefillOnly(e.target.checked)}/> Refill listed</label>
   </div>
   <div className="owner-table-scroll"><table className="owner-table">
    <thead><tr><th>Supplier</th><th>Service</th><th>USD / 1,000</th><th>Qty limits</th><th>Refill</th><th>Speed</th><th></th></tr></thead>
    <tbody>{products.slice(0,250).map(x=><tr key={x.supplier+":"+x.id}>
     <td>{x.supplier}</td><td><strong>{x.name}</strong><small>{x.platform} · {x.kind}</small></td>
     <td>{money(x.rateUSDPer1000)}</td><td>{x.min.toLocaleString()} – {x.max.toLocaleString()}</td>
     <td>{x.refillAdvertised?"Listed":"Not listed"}</td>
     <td>{x.advertisedDelivery?x.advertisedDelivery+" (advertised)":"Unverified"}</td>
     <td><button type="button" className="owner-small" onClick={()=>choose(x)}>Select</button></td>
    </tr>)}</tbody>
   </table></div>
   {!products.length&&<p>No eligible supplier services match your filters.</p>}
   {products.length>250&&<p className="owner-muted">Showing first 250 results. Refine the search to see more.</p>}
  </section>
  <section className="owner-box" aria-label="Private wholesale purchase">
   <p className="owner-eyebrow">SUPPLIER WALLET CHECKOUT · NO PAYKINGS</p>
   <h2>{selected?"Wholesale order: "+selected.name:"Choose a service to begin"}</h2>
   {selected&&<><div className="owner-form">
    <label>Supplier<input value={selected.supplier} readOnly/></label>
    <label>Quantity<input type="number" inputMode="numeric" value={quantity} min={selected.min} max={selected.max} step={selected.step}
      onChange={e=>{setQuantity(e.target.value===""?0:Number(e.target.value));setQuote(null);setAgree(false)}}/></label>
    <label className="owner-full">Public profile or post URL<input value={target} onChange={e=>{setTarget(e.target.value);setQuote(null);setAgree(false)}}
     placeholder="https://www.instagram.com/username/" autoCorrect="off" autoCapitalize="none" spellCheck={false}/></label>
   </div>
   <p className="owner-muted">Provider rate {money(selected.rateUSDPer1000)} / 1,000. Supported range: {selected.min.toLocaleString()}–{selected.max.toLocaleString()}.</p>
   <button type="button" className="owner-primary" disabled={busy||!target.trim()} onClick={price}>
    {busy?"Checking…":"Check actual wholesale total"}</button>
   {quote&&<div className="owner-review">
    <h3>Confirm one real supplier-wallet purchase</h3>
    <dl><div><dt>Supplier</dt><dd>{selected.supplier}</dd></div>
     <div><dt>Wholesale amount · no markup</dt><dd>{dollars(quote.wholesaleCents)}</dd></div>
     <div><dt>Current supplier balance</dt><dd>{dollars(quote.walletBalanceCents)}</dd></div>
     <div><dt>Quantity</dt><dd>{quote.quantity.toLocaleString()}</dd></div></dl>
    {!quote.walletEnough&&<p role="alert">Insufficient prepaid supplier balance.</p>}
    <p className="owner-muted">This quote expires in two minutes. The backend rechecks price and wallet balance before ordering. An uncertain supplier response will be held for manual reconciliation, never automatically retried.</p>
    <label className="owner-checkbox"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/>
     I approve this specific supplier order and the {dollars(quote.wholesaleCents)} prepaid-wallet deduction.</label>
    <button type="button" className="owner-primary" onClick={purchase}
     disabled={!data.purchasesEnabled||!quote.walletEnough||!agree||busy||Date.now()>quote.expires}>
     {data.purchasesEnabled?"Confirm & Purchase at Wholesale":"Purchasing securely locked"}</button>
   </div>}
   </>}
   {result&&<p className="owner-success" role="status">Order {result.orderId} submitted to {result.supplier}. Supplier order #{result.supplierOrderId}. Your prepaid wallet is the payment method. Check its delivery status below.</p>}
  </section>
  <section className="owner-box" aria-labelledby="owner-history-title">
   <div className="owner-row"><h2 id="owner-history-title">Private purchase history</h2>
    <button className="owner-small" onClick={reload} type="button">Refresh history</button></div>
   {!data.history?.length&&<p>No owner portal purchases have been recorded in this ledger.</p>}
   <div className="owner-table-scroll"><table className="owner-table"><thead><tr>
    <th>Placed</th><th>Supplier</th><th>Service</th><th>Wholesale</th><th>Status</th><th>Track</th></tr></thead>
    <tbody>{(data.history||[]).map(x=><tr key={x.id}>
     <td>{new Date(x.created_at).toLocaleString()}</td><td>{x.supplier}</td>
     <td>{x.service_name}<small>{x.quantity.toLocaleString()} units · {x.supplier_order_id||"No supplier ID"}</small></td>
     <td>{dollars(x.wholesale_cents)}</td><td>{x.state}</td>
     <td><button className="owner-small" type="button" disabled={busy} onClick={()=>track(x.id)}>Track</button></td>
    </tr>)}</tbody></table></div>
   {status&&<div className="owner-review" role="status"><strong>Order status: {status.state}</strong>
    <p>Supplier ID: {status.supplier_order_id||"Not assigned"}</p>
    {status.needsManualReview&&<p className="owner-warning">Supplier outcome uncertain. Do not retry or purchase a replacement until reconciled.</p>}</div>}
  </section></>}
 </div>;
}
