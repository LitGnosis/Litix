"use client";
import {useEffect,useMemo,useState} from "react";
const panel={background:"#091d35",border:"1px solid #365f87",borderRadius:18,padding:22};
const field={width:"100%",boxSizing:"border-box",padding:"12px 14px",background:"#102b49",
 color:"#ecf6ff",border:"1px solid #5b88b0",borderRadius:10,fontSize:16};
const btn={border:"1px solid #7bb6ee",borderRadius:11,padding:"12px 17px",
 background:"#2075bd",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer"};
const note={fontSize:14,color:"#b4cbe2",lineHeight:1.5};
const usd=value=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(value)||0);
const request=async(path,options)=>{
 const res=await fetch(path,{cache:"no-store",credentials:"same-origin",...options});
 const payload=await res.json().catch(()=>({error:"Unable to read response"}));
 if(!res.ok)throw Error(payload?.error||"Request failed");
 return payload;
};
const post=(path,body)=>request(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
export default function OwnerWholesaleUI(){
 const [access,setAccess]=useState("checking"),[code,setCode]=useState(""),[authBusy,setAuthBusy]=useState(false);
 const [catalog,setCatalog]=useState(null),[loading,setLoading]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [platform,setPlatform]=useState("Instagram"),[kind,setKind]=useState("followers");
 const [usaOnly,setUsaOnly]=useState(true),[search,setSearch]=useState("");
 const [serviceId,setServiceId]=useState(""),[quantity,setQuantity]=useState("");
 const [destination,setDestination]=useState(""),[quote,setQuote]=useState(null),[confirmed,setConfirmed]=useState(false);
 const [quoting,setQuoting]=useState(false),[buying,setBuying]=useState(false),[order,setOrder]=useState(null);
 const [refreshing,setRefreshing]=useState(false);
 async function loadCatalog(){
  setLoading(true);setError("");
  try{
   const response=await request("/api/owner/wholesale?view=catalog");
   setCatalog(response);
   setMessage("Live supplier prices are available only in this owner session.");
  }catch(e){setError(String(e.message||e));if(/login_required/.test(String(e.message)))setAccess("login")}
  finally{setLoading(false)}
 }
 useEffect(()=>{
  let mounted=true;
  request("/api/owner/wholesale/access")
   .then(v=>{if(mounted){setAccess(v.authenticated?"owner":"login");if(v.authenticated)void loadCatalog()}})
   .catch(()=>{if(mounted)setAccess("login")});
  return()=>{mounted=false};
 },[]);
 const matches=useMemo(()=>{
  const all=Array.isArray(catalog?.items)?catalog.items:[];
  return all.filter(x=>(platform==="All"||x.platform===platform)&&
   (kind==="All"||x.kind===kind)&&(!usaOnly||x.usa)&&
   (!search.trim()||[x.name,x.category,x.id].join(" ").toLowerCase().includes(search.trim().toLowerCase())))
   .slice(0,140);
 },[catalog,platform,kind,usaOnly,search]);
 const selected=useMemo(()=>catalog?.items?.find(x=>x.id===serviceId)||null,[catalog,serviceId]);
 function resetQuote(){setQuote(null);setConfirmed(false);setOrder(null);setError("");}
 async function signIn(action){
  setAuthBusy(true);setError("");setMessage("");
  try{
   const data=await post("/api/owner/wholesale/access",
    action==="verify_code"?{action,code:code.trim()}:{action});
   if(data.authenticated){setAccess("owner");setCode("");await loadCatalog()}
   else if(data.codeSent){setAccess("code");setMessage("Verification code sent to the private owner email. Expires in 10 minutes.")}
  }catch(e){setError(String(e.message||e))}finally{setAuthBusy(false)}
 }
 async function logout(){
  try{await post("/api/owner/wholesale/access",{action:"logout"})}catch{}
  setAccess("login");setCatalog(null);setQuote(null);setOrder(null);setCode("");
 }
 async function getQuote(){
  if(!serviceId||!quantity||!destination.trim())return;
  setQuoting(true);setError("");setMessage("");setQuote(null);setConfirmed(false);
  try{
   const data=await post("/api/owner/wholesale",
    {action:"quote",serviceId,quantity:Number(quantity),destination:destination.trim()});
   setQuote(data);setMessage("Wholesale price confirmed against Boostero. Your wallet will be charged only if you approve the purchase.");
  }catch(e){setError(String(e.message||e))}finally{setQuoting(false)}
 }
 async function purchase(){
  if(!quote||!confirmed||buying)return;
  setBuying(true);setError("");setMessage("");
  // One request per owner confirmation. Do not retry uncertain supplier outcomes.
  const key=crypto.randomUUID();
  try{
   const data=await post("/api/owner/wholesale",{
    action:"purchase",serviceId,quantity:Number(quantity),destination:destination.trim(),
    expectedWholesaleCents:quote.wholesaleCents,idempotencyKey:key,confirmed:true
   });
   setOrder(data);setQuote(null);setConfirmed(false);
   setMessage("The supplier order has been recorded. Review its status below; do not submit the same order again.");
  }catch(e){
   setError(String(e.message||e)+" If an order may have been submitted, check existing orders before trying again.");
   setOrder({orderId:null,fulfillment:"REVIEW_REQUIRED"});
   setQuote(null);setConfirmed(false);
  }finally{setBuying(false)}
 }
 async function refreshOrder(){
  if(!order?.orderId||refreshing)return;
  setRefreshing(true);setError("");
  try{
   const data=await request("/api/owner/wholesale?view=order&id="+encodeURIComponent(order.orderId));
   setOrder(previous=>({...previous,current:data.order}));
  }catch(e){setError(String(e.message||e))}finally{setRefreshing(false)}
 }
 const accessible=access==="owner";
 return <main style={{minHeight:"100vh",padding:"24px 14px 70px",
  background:"radial-gradient(ellipse at top,#153e6c,#061525 70%)",
  color:"#ebf5ff",fontFamily:"Arial,sans-serif"}}>
  <div style={{maxWidth:920,margin:"auto",display:"grid",gap:20}}>
   <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
    <a href="/" style={{fontSize:25,fontWeight:900,color:"#f1f8ff",textDecoration:"none"}}>LITIX.NET</a>
    <div style={{display:"flex",gap:15,alignItems:"center"}}>
     <a href="/track" style={{color:"#a8d8ff"}}>Track Order</a>
     {accessible&&<button type="button" style={{...btn,background:"#152c45"}} onClick={logout}>Sign out</button>}
    </div>
   </header>
   <section style={panel}>
    <p style={{color:"#80c9ff",letterSpacing:2,fontSize:12,fontWeight:800}}>PRIVATE OWNER ACCESS</p>
    <h1 style={{fontSize:"clamp(26px,5vw,42px)",margin:"8px 0"}}>Wholesale Purchase Center</h1>
    <p style={note}>Your private supplier-cost shopping area. Customer storefront prices remain unchanged. Owner orders spend your existing Boostero wallet directly—there is no PayKings card charge or extra markup.</p>
   </section>
   {!accessible&&<section style={panel}>
    <h2>{access==="code"?"Enter your 8-digit access code":"Verify owner access"}</h2>
    <p style={note}>Wholesale prices are never public. Access requires a temporary code delivered to the verified owner mailbox.</p>
    {access==="checking"?<p>Checking access…</p>:access==="code"?<>
     <label style={{display:"grid",gap:8,maxWidth:330}}>Access code
      <input style={field} inputMode="numeric" autoComplete="one-time-code" maxLength={8}
       value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}
       placeholder="8-digit code"/></label>
     <div style={{display:"flex",gap:10,marginTop:15,flexWrap:"wrap"}}>
      <button type="button" style={btn} disabled={authBusy||code.length!==8}
       onClick={()=>signIn("verify_code")}>Verify and open wholesale</button>
      <button type="button" style={{...btn,background:"#18314d"}} disabled={authBusy}
       onClick={()=>setAccess("login")}>Back</button>
     </div>
    </>:<button type="button" style={btn} disabled={authBusy}
      onClick={()=>signIn("request_code")}>{authBusy?"Sending…":"Email my owner access code"}</button>}
   </section>}
   {accessible&&<section style={panel}>
    <div style={{display:"flex",gap:20,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
     <div><h2 style={{marginBottom:5}}>Boostero wholesale catalog</h2>
      <p style={note}>{catalog?.count?.toLocaleString()||"—"} available standard services · Prepaid supplier wallet</p></div>
     <div style={{textAlign:"right"}}><span style={note}>Boostero wallet balance</span>
      <h2 style={{margin:"3px 0"}}>{catalog?usd(catalog.walletUSD):"—"}</h2></div>
    </div>
    <button type="button" style={{...btn,background:"#173c62"}} disabled={loading}
     onClick={loadCatalog}>{loading?"Refreshing…":"Refresh current prices and balance"}</button>
    {!catalog&&<p style={note}>{loading?"Checking live supplier…":"Catalog not currently available."}</p>}
   </section>}
   {accessible&&catalog&&<section style={panel}>
    <h2 style={{marginTop:0}}>Choose a service</h2>
    <p style={note}>Instagram USA Followers are shown first. You can switch platforms and service types to buy other eligible services at their live Boostero cost.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,200px),1fr))",gap:12}}>
     <label style={{display:"grid",gap:7}}>Platform
      <select style={field} value={platform} onChange={e=>{
       setPlatform(e.target.value);setUsaOnly(e.target.value==="Instagram");setServiceId("");resetQuote()}}>
       {["Instagram","TikTok","YouTube","Twitter (X)","Facebook","Spotify","Telegram","Other","All"].map(s=><option key={s}>{s}</option>)}
      </select></label>
     <label style={{display:"grid",gap:7}}>Service
      <select style={field} value={kind} onChange={e=>{setKind(e.target.value);setServiceId("");resetQuote()}}>
       {["followers","likes","views","shares","subscribers","comments","plays","saves","members","traffic","other","All"].map(s=><option key={s}>{s}</option>)}
      </select></label>
     <label style={{display:"grid",gap:7}}>Search services
      <input style={field} placeholder="USA, active, service ID…" value={search}
       onChange={e=>{setSearch(e.target.value);setServiceId("");resetQuote()}}/></label>
    </div>
    <label style={{display:"flex",alignItems:"center",gap:10,margin:"16px 0"}}>
     <input type="checkbox" checked={usaOnly}
      onChange={e=>{setUsaOnly(e.target.checked);setServiceId("");resetQuote()}}/>
     <span>American / USA services only</span>
    </label>
    <label style={{display:"grid",gap:7,marginTop:14}}>Wholesale service ({matches.length} matches shown)
     <select style={field} value={matches.some(s=>s.id===serviceId)?serviceId:""} onChange={e=>{
      const id=e.target.value,service=catalog.items.find(x=>x.id===id);
      setServiceId(id);setQuantity(service?String(service.min):"");resetQuote()}}>
      <option value="">Select a supplier service</option>
      {matches.map(s=><option key={s.id} value={s.id}>
       {s.name} · {usd(s.rateUSDPer1000)}/1,000 · Min {s.min}
      </option>)}
     </select></label>
    {selected&&<div style={{border:"1px solid #2c5e85",borderRadius:12,padding:15,marginTop:15}}>
     <strong>{selected.name}</strong>
     <p style={note}>{selected.platform} · {selected.kind} · Wholesale rate {usd(selected.rateUSDPer1000)} per 1,000</p>
     <p style={note}>Supplier quantity limits: {selected.min.toLocaleString()}–{selected.max.toLocaleString()}</p>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,250px),1fr))",gap:12,marginTop:17}}>
     <label style={{display:"grid",gap:7}}>Quantity
      <input style={field} type="number" min={selected?.min||1} max={selected?.max||1000000}
       value={quantity} onChange={e=>{setQuantity(e.target.value);resetQuote()}}/></label>
     <label style={{display:"grid",gap:7}}>Public profile or post URL
      <input style={field} type="text" value={destination} autoComplete="off" spellCheck={false}
       placeholder="@username or https://…" onChange={e=>{setDestination(e.target.value);resetQuote()}}/></label>
    </div>
    <p style={{...note,marginTop:12}}>For Instagram or TikTok Followers you can enter @username or a profile link. Other services need an eligible public post or destination URL. Never enter an account password.</p>
    <button type="button" style={{...btn,marginTop:6}} disabled={!selected||!destination||quoting||buying||!!order}
     onClick={getQuote}>{quoting?"Checking live cost…":"Check current wholesale cost"}</button>
    {quote&&<div style={{marginTop:20,padding:18,background:"#12365a",border:"1px solid #498ec5",borderRadius:13}}>
     <p style={{...note,margin:0}}>Your supplier-wallet debit (no markup)</p>
     <div style={{fontSize:37,fontWeight:900,margin:"7px 0"}}>{usd(quote.wholesaleCents/100)}</div>
     <p style={note}>Boostero's current cost: {usd(quote.wholesaleUSD)} · Available wallet: {usd(quote.supplierBalanceUSD)}</p>
     {!quote.balanceEnough?<p role="alert" style={{color:"#ffb7ba"}}>Not enough prepaid Boostero balance. No order can be submitted.</p>:<>
      <label style={{display:"flex",gap:10,alignItems:"start",margin:"16px 0"}}>
       <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
       <span>I authorize this real Boostero-wallet purchase at the displayed wholesale cost.</span>
      </label>
      <button type="button" style={{...btn,background:"#196b68"}} disabled={!confirmed||buying||!!order}
       onClick={purchase}>{buying?"Submitting once — do not retry":"Buy with Boostero wallet · "+usd(quote.wholesaleCents/100)}</button>
     </>}
    </div>}
   </section>}
   {message&&<section role="status" style={{...panel,color:"#b9e5ff"}}>{message}</section>}
   {error&&<section role="alert" style={{...panel,borderColor:"#bf6170",color:"#ffc5c6"}}>{error}</section>}
   {order&&<section style={panel}>
    <h2>Owner order status</h2>
    <p style={note}>No card charged. The supplier order is recorded in Litix. Check the current status before making another purchase.</p>
    {order.orderId&&<p><strong>Litix order:</strong> <code>{order.orderId}</code></p>}
    <p><strong>Fulfillment:</strong> {order.current?.delivery_state||order.fulfillment||"Awaiting review"}</p>
    {order.supplierOrderId&&<p><strong>Supplier order:</strong> {order.supplierOrderId}</p>}
    {order.current?.supplier_status?.status&&<p><strong>Provider update:</strong> {order.current.supplier_status.status}</p>}
    {order.orderId&&<button type="button" style={btn} disabled={refreshing} onClick={refreshOrder}>
     {refreshing?"Refreshing…":"Refresh order status"}</button>}
   </section>}
   <footer style={{...note,padding:"18px 4px 30px"}}>Private access only. Public Litix customer pricing, bundles and existing paid orders are not changed.</footer>
  </div>
 </main>;
}
