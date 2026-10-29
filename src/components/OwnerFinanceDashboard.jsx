"use client";
import {useEffect,useState} from "react";
const money=c=>Number.isSafeInteger(c)?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(c/100):"Not reconciled";
const date=d=>d?new Date(d).toLocaleString():"Unknown";
const blank={};
export default function OwnerFinanceDashboard(){
 const [data,setData]=useState(null),[state,setState]=useState("loading"),[error,setError]=useState("");
 const refresh=async()=>{
  setState("loading");setError("");
  try{
   const r=await fetch("/api/owner/finance",{credentials:"same-origin",cache:"no-store",headers:{"accept":"application/json"}});
   if(!r.ok)throw Error(r.status===401?"Session expired; sign in again.":"Financial records are unavailable; no changes were made.");
   const x=await r.json();setData(x);setState("ready");
  }catch(e){setState("error");setError(e.message)}
 };
 useEffect(()=>{refresh()},[]);
 const m=data?.metrics||blank;
 const tiles=[
  ["Verified paid orders",m.verifiedPaidOrders??"—"],
  ["Captured revenue",money(m.grossCapturedCents)],
  ["Recorded wholesale",money(m.recordedBoosteroWholesaleCents)],
  ["Contribution before fees",money(m.contributionBeforeFeesAndRefundsCents)],
  ["Net profit",money(m.netContributionProfitCents)],
  ["Awaiting fulfillment",money(m.paidUnfulfilledValueCents)],
  ["Last 24 hours",money(m.last24hV2RevenueCents)],
  ["Last 7 days",money(m.last7dV2RevenueCents)],
  ["Last 30 days",money(m.last30dV2RevenueCents)],
  ["PayKings v2 captured",money(m.paykingsV2Cents)],
  ["Verified bundles",money(m.verifiedBundlesCents)],
  ["Publicly approved services",data?.serviceOperations?.approvedPublicServices??"—"]
 ];
 return <main className="lf-root">
  <div className="lf-container">
   <nav className="lf-nav"><a href="/" className="lf-brand">LITIX<span> PLATINUM</span></a><a href="/owner/wholesale/logout">Sign out</a></nav>
   <header className="lf-header">
    <span className="lf-eyebrow">PRIVATE OWNER FINANCIAL OPERATIONS · READ ONLY</span>
    <h1>Business performance, <em>without guesswork.</em></h1>
    <p>Verified paid transactions, supplier expenses and fulfillment progress from the existing Litix ledgers.</p>
    <div className="lf-actions"><button type="button" onClick={refresh} disabled={state==="loading"}>{state==="loading"?"Refreshing…":"Refresh records"}</button><small>Last retrieved: {date(data?.asOf)}</small></div>
   </header>
   {state==="error"&&<p className="lf-error" role="alert">{error}</p>}
   {state==="loading"&&!data&&<p role="status">Retrieving protected financial records…</p>}
   {data&&<>
    <section className="lf-notice" aria-label="Financial reporting coverage"><strong>Verified revenue only.</strong> Net profit, fees, chargebacks and unreconciled Stripe settlements remain marked unavailable until processor records can be matched. Legacy payment ledgers are not added twice.</section>
    <section className="lf-metrics" aria-label="Financial metrics">{tiles.map(([label,val])=><article className="lf-metric" key={label}><span>{label}</span><strong>{val}</strong></article>)}</section>
    <section className="lf-panel"><h2>Orders and fulfillment</h2><p>Latest {data.orders?.length||0} canonical service orders. This page never submits payments or supplier orders.</p>
     <div className="lf-table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Service</th><th>Quantity</th><th>Retail</th><th>Wholesale</th><th>Payment</th><th>Fulfillment</th><th>Updated</th></tr></thead>
      <tbody>{(data.orders||[]).map(x=><tr key={x.id}><td>{x.id}</td><td>{x.email}</td><td>{x.service_name}</td><td>{x.quantity}</td><td>{money(x.amount_cents)}</td><td>{money(x.supplier_cost_cents)}</td><td>{x.payment_state}</td><td>{x.fulfillment_state}</td><td>{date(x.updated_at)}</td></tr>)}
       {!data.orders?.length&&<tr><td colSpan={9}>No canonical orders found.</td></tr>}</tbody></table></div>
    </section>
    <section className="lf-panel"><h2>Bundles</h2><p>Launch, Momentum, Power and Apex purchases remain manually fulfilled according to their existing payment rules.</p>
     <div className="lf-table-wrap"><table><thead><tr><th>Order</th><th>Bundle</th><th>Customer</th><th>Price</th><th>Provider</th><th>Payment</th><th>Fulfillment</th></tr></thead><tbody>{(data.bundles||[]).map(x=><tr key={x.id}><td>{x.id}</td><td>{x.package_name}</td><td>{x.email}</td><td>{money(Number(x.price_cents))}</td><td>{x.payment_provider||"Unknown"}</td><td>{x.payment_state}</td><td>{x.order_state}</td></tr>)}{!data.bundles?.length&&<tr><td colSpan={7}>No recorded bundles.</td></tr>}</tbody></table></div>
    </section>
    <section className="lf-panel"><h2>Most purchased services</h2><div className="lf-table-wrap"><table><thead><tr><th>Service</th><th>Verified orders</th><th>Captured</th><th>Recorded supplier cost</th></tr></thead><tbody>{(data.topServices||[]).map((x,i)=><tr key={i}><td>{x.service_name}</td><td>{x.paid_orders}</td><td>{money(Number(x.gross_cents))}</td><td>{money(Number(x.recorded_supplier_cents))}</td></tr>)}</tbody></table></div></section>
    <section className="lf-panel"><h2>Accounting coverage and reconciliation</h2><p>Previously settled legacy PayKings ledger: {m.legacyGatewayOrdersExcluded??0} records · {money(m.legacyGatewayCentsExcludedFromTotal)}. Shown separately to avoid counting the same payment twice.</p><p>Processor fees: {money(m.processorFeesCents)} · Refunds/chargebacks: {money(m.refundsAndChargebacksCents)} · Stripe settlements: {money(m.stripeCapturedCents)}.</p></section>
   </>}
  </div>
 </main>;
}
