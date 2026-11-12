"use client";
import {useState} from "react";
const time=v=>v?new Date(v).toLocaleString():"Not checked";
const colors={healthy:"#72dfb3",down:"#ff7373",degraded:"#ffd178",unknown:"#bcc8d8",not_launched:"#92a7bd"};
export default function GuardianAdmin(){
 const [token,setToken]=useState(""),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function refresh(e){
  e?.preventDefault();if(!token.trim())return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/guardian/admin",{headers:{"authorization":"Bearer "+token.trim()},cache:"no-store"});
   const d=await r.json();if(!r.ok)throw Error(r.status===401?"Invalid owner access token.":"Dashboard data temporarily unavailable.");
   setResult(d);
  }catch(e){setResult(null);setError(e.message)}
  finally{setBusy(false)}
 }
 const parts=result?.components||[],incidents=result?.incidents||[],alerts=result?.alerts||[],runs=result?.runs||[];
 const active=incidents.filter(x=>!x.resolved_at).length;
 const triage=result?.triage?.items||[];
 return <main className="wrap" style={{maxWidth:1040,margin:"0 auto",padding:"26px 15px 80px"}}>
  <nav className="nav"><a className="brand" href="/">LITIX</a><a href="/">Return to LITIX</a></nav>
  <section className="panel" style={{marginTop:28}}>
   <div className="kicker">LITIX GUARDIAN · PRIVATE SYSTEM HEALTH</div><h1>Guardian diagnostics</h1>
   <p className="small">Read-only status, incident history, diagnostic results and alert delivery. No payments, customer data, supplier orders or credentials appear here.</p>
   <form onSubmit={refresh} className="form" style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    <label style={{flex:"1 1 280px"}}>Owner access token
     <input type="password" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off" placeholder="Enter existing Vercel ADMIN_SECRET" required/>
    </label>
    <button className="pay" disabled={busy||!token.trim()} type="submit">{busy?"Checking…":result?"Refresh health":"Unlock dashboard"}</button>
    {result&&<button type="button" className="alt" onClick={()=>{setToken("");setResult(null);setError("")}}>Lock</button>}
   </form>
   {error&&<p role="alert">{error}</p>}
  </section>
  {result&&<>
   <section className="panel" style={{marginTop:18}}>
    <h2>Current component status</h2><p className="small">{parts.length} monitored components · {active} active incidents · Latest run: {time(runs[0]?.finished_at)}</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12}}>
     {parts.map(c=><article key={c.component} style={{background:"#111e30",border:"1px solid #44637a",borderRadius:13,padding:16}}>
      <h3 style={{margin:"0 0 9px",fontSize:17}}>{c.component.replaceAll("_"," ")}</h3>
      <p style={{fontWeight:800,color:colors[c.status]||colors.unknown,margin:"4px 0 10px"}}>{c.status.toUpperCase().replaceAll("_"," ")}</p>
      <p className="small">{c.last_result?.code||"NOT CHECKED"}</p>
      <p className="small">{c.last_result?.detail||"Awaiting diagnostic run"}</p>
      <p className="small">Checked: {time(c.checked_at)}</p>
      {c.status==="down"&&<p className="small">Consecutive failures: {c.consecutive_failures}</p>}
     </article>)}
    </div>
   </section>
   <section className="panel" style={{marginTop:18}}>
    <h2>Owner action queue</h2>
    <p className="small">Private, read-only reconciliation guide. No supplier purchases, refunds, wallet transfers or card charges are triggered here.</p>
    {result.triage?.unavailableChecks>0&&<p role="alert" className="small">{result.triage.unavailableChecks} diagnostic sources are temporarily unavailable; absence of a listed issue is not proof of health.</p>}
    {triage.length?<div style={{overflowX:"auto"}}>
      <table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}>
       <thead><tr><th>Priority</th><th>Litix order</th><th>Supplier ID / Post</th><th>Safe next action</th></tr></thead>
       <tbody>{triage.map((x,i)=><tr key={x.code+x.orderId+x.postIndex+i} style={{borderTop:"1px solid #426078"}}>
        <td style={{padding:"10px 12px 10px 0",color:"#ffd178"}}>{x.code.replaceAll("_"," ")}</td>
        <td style={{fontSize:12,overflowWrap:"anywhere"}}>{x.orderId}</td>
        <td>{x.supplierOrderId||"Not confirmed"}{x.postIndex?" · Post "+x.postIndex:""}</td>
        <td style={{fontSize:13}}>{x.action}</td>
       </tr>)}</tbody>
      </table>
     </div>:<p className="small">No current paid-order reconciliation exceptions found in the available diagnostic sources.</p>}
   </section>
   <section className="panel" style={{marginTop:18}}>
    <h2>Recent incidents</h2>
    {incidents.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}>
     <thead><tr><th>Component</th><th>Cause</th><th>Started</th><th>Resolved</th></tr></thead>
     <tbody>{incidents.map(x=><tr key={x.id} style={{borderTop:"1px solid #426078"}}><td style={{padding:"10px 12px 10px 0"}}>{x.component}</td><td>{x.cause_code}</td><td>{time(x.started_at)}</td><td>{x.resolved_at?time(x.resolved_at):"Open"}</td></tr>)}</tbody>
    </table></div>:<p className="small">No confirmed incidents recorded.</p>}
   </section>
   <section className="panel" style={{marginTop:18}}>
    <h2>Recent notifications</h2>
    {alerts.length?alerts.map((a,i)=><p key={i} className="small">{a.component} · {a.kind} · {a.status} · {time(a.sent_at||a.created_at)}</p>):<p className="small">No outage, escalation, or recovery emails required yet.</p>}
    <h3>Recent runs</h3>{runs.length?runs.slice(0,12).map(x=><p key={x.id} className="small">{time(x.finished_at)} · {x.component_count} checked · {x.unhealthy_count} failed</p>):<p className="small">Awaiting first scheduled run.</p>}
   </section>
  </>}
 </main>
}
