"use client";
import {useEffect,useMemo,useState} from "react";
import OwnerPayKingsFields from "./OwnerPayKingsFields.jsx";
import OwnerRecoveryPanel from "./OwnerRecoveryPanel.jsx";
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
 if(!res.ok){
  const e=new Error(payload?.error||"Request failed");
  e.details=payload;
  e.status=res.status;
  throw e;
 }
 return payload;
};
const post=(path,body)=>request(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
export default function OwnerWholesaleUI(){
 const [access,setAccess]=useState("checking"),[code,setCode]=useState(""),[authBusy,setAuthBusy]=useState(false);
 const [catalog,setCatalog]=useState(null),[loading,setLoading]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [platform,setPlatform]=useState("Instagram"),[kind,setKind]=useState("followers");
 const [usaOnly,setUsaOnly]=useState(false),[search,setSearch]=useState("");
 const [serviceId,setServiceId]=useState(""),[quantity,setQuantity]=useState("");
 const [destination,setDestination]=useState(""),[quote,setQuote]=useState(null),[confirmed,setConfirmed]=useState(false);
 const [quoting,setQuoting]=useState(false),[buying,setBuying]=useState(false),[order,setOrder]=useState(null);
 const [refreshing,setRefreshing]=useState(false);
 const [paymentMethod,setPaymentMethod]=useState("paykings");
 const [ownerPurpose,setOwnerPurpose]=useState("personal");
 const [replacementOf,setReplacementOf]=useState("");
 async function loadCatalog(){
  setLoading(true);setError("");
  try{
   const response=await request("/api/owner/wholesale?view=catalog");
   setCatalog(response);
   if(!response.paykingsEnabled)setPaymentMethod("supplier_balance");
   setMessage(response.paykingsEnabled?
    "Owner PayKings and wallet methods are available for eligible orders.":
    "Private supplier-cost shopping is available. Owner-funded PayKings card charges need merchant approval; the Boostero wallet method remains available.");
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
  const qualified=all.filter(x=>(platform==="All"||x.platform===platform)&&
   (kind==="All"||x.kind===kind)&&(!usaOnly||x.usa)&&
   (!search.trim()||[x.name,x.category,x.id].join(" ").toLowerCase().includes(search.trim().toLowerCase())));
  // Keep both USA and international options accessible in longer catalogs.
  const american=qualified.filter(x=>x.usa).slice(0,120);
  const international=usaOnly?[]:qualified.filter(x=>!x.usa).slice(0,120);
  return [...american,...international];
 },[catalog,platform,kind,usaOnly,search]);
 const selected=useMemo(()=>catalog?.items?.find(x=>x.id===serviceId)||null,[catalog,serviceId]);
 function resetQuote(){setQuote(null);setConfirmed(false);setError("");}
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
    {action:"quote",serviceId,quantity:Number(quantity),destination:destination.trim(),paymentMethod});
   setQuote(data);setMessage(paymentMethod==="paykings"?
    "Live wholesale amount confirmed. Your card is charged only after you authorize PayKings secure checkout.":
    "Wholesale price confirmed against Boostero. Your wallet is debited only after you approve.");
  }catch(e){setError(String(e.message||e))}finally{setQuoting(false)}
 }
 async function purchase(paymentToken=""){
  if(!quote||!confirmed||buying||!!order)return;
  if(paymentMethod==="paykings"&&!paymentToken)return;
  setBuying(true);setError("");setMessage("");
  // Unique key; never retry an uncertain PayKings transaction under a new key.
  const key=crypto.randomUUID();
  try{
   const data=await post("/api/owner/wholesale",{
    action:"purchase",paymentMethod,ownerPurpose,
    ...(ownerPurpose==="replacement"?{replacementOf}:{}),
    ...(paymentMethod==="paykings"?{paymentToken}:{}),
    serviceId,quantity:Number(quantity),destination:destination.trim(),
    expectedWholesaleCents:quote.wholesaleCents,
    expectedChargeCents:quote.chargeAmountCents,
    idempotencyKey:key,confirmed:true
   });
   if(!data?.orderId){
    throw Object.assign(new Error(data?.error||"No confirmed order ID was returned"),{
     details:data,status:202
    });
   }
   setOrder(data);setQuote(null);setConfirmed(false);
   setMessage(data.payment==="review"?
    "PayKings outcome requires review. Do not retry this order or card payment.":
    "Order "+data.orderId+" is recorded. Check its supplier status before another order.");
  }catch(e){
   const details=e.details||{};
   const definitelyUncharged=details.chargeAttempted===false&&
    !details.orderId&&paymentMethod==="supplier_balance";
   if(definitelyUncharged){
    // A pre-ledger failure cannot debit the wallet: leave the product editable.
    setOrder(null);
    setError(String(e.message||e)+" The order was not recorded, and your wallet was not debited. You can review a fresh quote after this issue is resolved.");
   }else{
    // Outcome is ambiguous: never assert that an order was recorded.
    setOrder({orderId:details.orderId||null,fulfillment:"REVIEW_REQUIRED",
      paymentMethod,unconfirmed:true});
    setError(String(e.message||e)+" Order outcome needs reconciliation. Do not pay again until checked.");
   }
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
    <p style={note}>Private supplier-cost shopping for your account, customer giveaways, drawing winners, and promotions. Choose PayKings card checkout or your Boostero prepaid wallet. Retail prices and customer cards remain unchanged.</p>
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
      <p style={note}>{catalog?.count?.toLocaleString()||"—"} available standard services · PayKings or supplier wallet</p></div>
     <div style={{textAlign:"right"}}><span style={note}>Boostero wallet balance</span>
      <h2 style={{margin:"3px 0"}}>{catalog?usd(catalog.walletUSD):"—"}</h2></div>
    </div>
    <button type="button" style={{...btn,background:"#173c62"}} disabled={loading}
     onClick={loadCatalog}>{loading?"Refreshing…":"Refresh current prices and balance"}</button>
    {!catalog&&<p style={note}>{loading?"Checking live supplier…":"Catalog not currently available."}</p>}
   </section>}
   {accessible&&catalog&&<section style={panel}>
    <h2 style={{marginTop:0}}>Choose a service</h2>
    <p style={note}><strong>American / USA packages appear first</strong>, starting with Instagram USA Followers. International services follow, all at your private Boostero supplier cost.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,200px),1fr))",gap:12}}>
     <label style={{display:"grid",gap:7}}>Platform
      <select style={field} value={platform} onChange={e=>{
       setPlatform(e.target.value);setServiceId("");resetQuote()}}>
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
     <span>Show American / USA services only (otherwise USA first, then all other locations)</span>
    </label>
    <label style={{display:"grid",gap:7,marginTop:14}}>Wholesale service ({matches.length} matches shown)
     <select style={field} value={matches.some(s=>s.id===serviceId)?serviceId:""} onChange={e=>{
      const id=e.target.value,service=catalog.items.find(x=>x.id===id);
      setServiceId(id);setQuantity(service?String(service.min):"");resetQuote()}}>
      <option value="">Select a supplier service</option>
      {matches.some(s=>s.usa)&&<optgroup label="USA / AMERICAN · FIRST">
       {matches.filter(s=>s.usa).map(s=><option key={s.id} value={s.id}>
        {s.name} · {usd(s.rateUSDPer1000)}/1,000 · Min {s.min}
       </option>)}
      </optgroup>}
      {matches.some(s=>!s.usa)&&<optgroup label="ALL OTHER LOCATIONS">
       {matches.filter(s=>!s.usa).map(s=><option key={s.id} value={s.id}>
        {s.name} · {usd(s.rateUSDPer1000)}/1,000 · Min {s.min}
       </option>)}
      </optgroup>}
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
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,230px),1fr))",gap:14,marginTop:16}}>
     <label style={{display:"grid",gap:7}}>Payment method
      <select style={field} value={paymentMethod} onChange={e=>{setPaymentMethod(e.target.value);resetQuote()}}>
       <option value="paykings" disabled={!catalog?.paykingsEnabled}>PayKings secure card — {catalog?.paykingsEnabled?"owner pays":"pending processor approval"}</option>
       <option value="supplier_balance">Boostero prepaid wallet</option>
      </select>
     </label>
     <label style={{display:"grid",gap:7}}>Reason for owner purchase
      <select style={field} value={ownerPurpose} onChange={e=>{setOwnerPurpose(e.target.value);resetQuote()}}>
       <option value="personal">Personal service</option>
       <option value="giveaway">Drawing / giveaway winner</option>
       <option value="promotion">Customer promotional reward</option>
       <option value="replacement">Replacement for confirmed failed order</option>
      </select>
     </label>
    </div>
    {ownerPurpose==="replacement"&&<label style={{display:"grid",gap:7,marginTop:15}}>
     Confirmed failed original Litix order ID
     <input style={field} value={replacementOf}
      onChange={e=>{setReplacementOf(e.target.value);resetQuote()}}
      placeholder="ltx2_..." spellCheck={false}/>
     <span style={note}>Use the order-recovery panel below to verify failure and absence of a supplier order ID. New card payment is separate; no repeat charge is automatic.</span>
    </label>}
    <button type="button" style={{...btn,marginTop:6}} disabled={!selected||!destination||quoting||buying||!!order||
     (ownerPurpose==="replacement"&&!/^ltx2_[0-9a-f-]{36}$/.test(replacementOf))}
     onClick={getQuote}>{quoting?"Checking live cost…":"Check current wholesale cost"}</button>
    {quote&&<div style={{marginTop:20,padding:18,background:"#12365a",border:"1px solid #498ec5",borderRadius:13}}>
     <p style={{...note,margin:0}}>{paymentMethod==="paykings"?"Your confirmed PayKings owner card amount":"Your Boostero prepaid wallet debit"} (no retail markup)</p>
     <div style={{fontSize:37,fontWeight:900,margin:"7px 0"}}>{usd(quote.chargeAmountCents/100)}</div>
     <p style={note}>Boostero supplier cost: {usd(quote.wholesaleCents/100)} · Available Boostero wallet: {usd(quote.supplierBalanceUSD)}</p>
     {quote.cardMinimumApplied&&<p style={{...note,color:"#ffd6a4"}}>The PayKings checkout minimum is $1.00 even when the supplier amount is lower. The difference covers processing costs.</p>}
     {!quote.balanceEnough?<p role="alert" style={{color:"#ffb7ba"}}>Not enough prepaid Boostero balance. No order can be submitted.</p>:<>
      <label style={{display:"flex",gap:10,alignItems:"start",margin:"16px 0"}}>
       <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
       <span>I authorize one {paymentMethod==="paykings"?"PayKings card payment":"Boostero wallet debit"} of {usd(quote.chargeAmountCents/100)} for this {ownerPurpose.replaceAll("_"," ")} order. I will not repeat a payment with an unknown outcome.</span>
      </label>
      {paymentMethod==="paykings"?
       catalog?.paykingsEnabled?
        <OwnerPayKingsFields key={quote.serviceId+":"+quote.quantity+":"+quote.chargeAmountCents}
         publicKey={catalog.cardPublicKey} amountCents={quote.chargeAmountCents}
         disabled={!confirmed||!!order} busy={buying} onToken={token=>void purchase(token)}/>:
        <p role="alert" style={{color:"#ffbfc3"}}>PayKings secure card checkout is unavailable. No card payment can be submitted. Choose wallet or contact support.</p>:
       <button type="button" style={{...btn,background:"#196b68"}} disabled={!confirmed||buying||!!order}
        onClick={()=>void purchase()}>{buying?"Submitting once — do not retry":"Buy with Boostero wallet · "+usd(quote.chargeAmountCents/100)}</button>}
     </>}
    </div>}
   </section>}
   {message&&<section role="status" style={{...panel,color:"#b9e5ff"}}>{message}</section>}
   {error&&<section role="alert" style={{...panel,borderColor:"#bf6170",color:"#ffc5c6"}}>{error}</section>}
   {order&&<section style={panel}>
    <h2>{order.orderId?"Owner order status":"Order status needs reconciliation"}</h2>
    <p style={note}>{order.orderId?
     (order.paymentMethod==="paykings"?"PayKings payment requested; verify its outcome below.":"Supplier wallet order record exists; check delivery status."):
     "No confirmed Litix order ID was returned. Do not assume an order was created or a payment was made. Contact Litix support for reconciliation before retrying."}</p>
    {order.orderId&&<p><strong>Litix order:</strong> <code>{order.orderId}</code></p>}
    <p><strong>Fulfillment:</strong> {order.current?.delivery_state||order.fulfillment||"Awaiting review"}</p>
    {order.supplierOrderId&&<p><strong>Supplier order:</strong> {order.supplierOrderId}</p>}
    {order.current?.supplier_status?.status&&<p><strong>Provider update:</strong> {order.current.supplier_status.status}</p>}
    {order.orderId&&<button type="button" style={btn} disabled={refreshing} onClick={refreshOrder}>
     {refreshing?"Refreshing…":"Refresh order status"}</button>}
   </section>}
   {accessible&&<OwnerRecoveryPanel onReplacement={original=>{
    setOwnerPurpose("replacement");setPaymentMethod("paykings");
    setReplacementOf(original.id);
    const found=catalog?.items?.find(x=>x.id===String(original.service_id));
    if(found){setPlatform(found.platform);setKind(found.kind);setSearch("");
     setUsaOnly(false);setServiceId(found.id)}
    setQuantity(String(original.quantity));
    setDestination(String(original.destination||""));
    if(!found)setServiceId("");
    resetQuote();
    setMessage("Confirmed failed order loaded. Review the new wholesale quote and authorize a separate PayKings payment only if you want a replacement.");
    window.scrollTo({top:0,behavior:"smooth"});
   }}/>}
   <footer style={{...note,padding:"18px 4px 30px"}}>Private access only. Public Litix customer pricing, bundles and existing paid orders are not changed.</footer>
  </div>
 </main>;
}
