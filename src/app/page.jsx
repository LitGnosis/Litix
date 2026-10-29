
"use client";
import {useEffect,useRef,useState} from "react";
import PremiumInlineCheckout from "../components/PremiumInlineCheckout";
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n/100);
// Collect.js is documented as a global named CollectJS. Some script builds expose
// that binding without a window property, so resolve both forms consistently.
const getCollectJS=()=>{try{if(typeof CollectJS!=="undefined")return CollectJS}catch{};return typeof window!=="undefined"?window.CollectJS:undefined};
const whatsappNumber=(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||"").replace(/\D/g,"");
const publicCollectKey=process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||"";
export default function Home(){
 const GenUIcopy=text=>{if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text)};
 const [services,setServices]=useState([]),[categories,setCategories]=useState([]),[favorites,setFavorites]=useState([]),[recentServices,setRecentServices]=useState([]),[savedOrders,setSavedOrders]=useState([]),[workspaceReady,setWorkspaceReady]=useState(false),[growthGoal,setGrowthGoal]=useState("Grow audience"),[industry,setIndustry]=useState("Creator"),[planDays,setPlanDays]=useState("30"),[planGenerated,setPlanGenerated]=useState(false),[campaignName,setCampaignName]=useState(""),[campaigns,setCampaigns]=useState([]),[cat,setCat]=useState(""),[query,setQuery]=useState(""),[platform,setPlatform]=useState("All platforms"),[favoritesOnly,setFavoritesOnly]=useState(false),[compareIds,setCompareIds]=useState([]),[pg,setPg]=useState(1),[catalogRetry,setCatalogRetry]=useState(0),[catalogState,setCatalogState]=useState("loading"),[count,setCount]=useState(0),[total,setTotal]=useState(0),[selected,setSelected]=useState(null),[qty,setQty]=useState(100),[email,setEmail]=useState(""),[link,setLink]=useState(""),[config,setConfig]=useState({ready:false}),[cardReady,setCardReady]=useState(false),[cardRetry,setCardRetry]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[receipt,setReceipt]=useState(null),[privateUrl,setPrivateUrl]=useState(""),[tracked,setTracked]=useState(null),[key,setKey]=useState("");const done=useRef(null);
 useEffect(()=>{setKey(crypto.randomUUID());try{setFavorites(JSON.parse(localStorage.getItem("litix:favorites")||"[]"));setRecentServices(JSON.parse(localStorage.getItem("litix:recent-services")||"[]"));setSavedOrders(JSON.parse(localStorage.getItem("litix:saved-orders")||"[]"));setCampaigns(JSON.parse(localStorage.getItem("litix:campaigns")||"[]"))}catch{}setWorkspaceReady(true);fetch("/api/config").then(r=>r.json()).then(v=>setConfig({...v,publicKey:v.publicKey||publicCollectKey,ready:!!(v.ready&& (v.publicKey||publicCollectKey))})).catch(()=>setConfig({ready:false,publicKey:publicCollectKey||""}))},[]);
 useEffect(()=>{const abort=new AbortController(),p=new URLSearchParams({category:cat,q:query,page:String(pg)});setCatalogState("loading");fetch("/api/smmservices?"+p,{signal:abort.signal}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Supplier catalog temporarily unavailable");return v}).then(v=>{setServices(v.items||[]);setCategories(v.categories||[]);setCount(v.allCount||0);setTotal(v.total||0);setCatalogState("ready");if(v.error)setNotice(v.error)}).catch(e=>{if(e.name!=="AbortError"){setCatalogState("error");setNotice("The supplier catalog is temporarily unavailable. Please retry in a moment; no order has been placed.")}});return()=>abort.abort()},[cat,query,pg,catalogRetry]);
 useEffect(()=>{if(!workspaceReady)return;try{localStorage.setItem("litix:favorites",JSON.stringify(favorites));localStorage.setItem("litix:recent-services",JSON.stringify(recentServices.slice(0,8)));localStorage.setItem("litix:saved-orders",JSON.stringify(savedOrders.slice(0,12)));localStorage.setItem("litix:campaigns",JSON.stringify(campaigns.slice(0,20)))}catch{}},[workspaceReady,favorites,recentServices,savedOrders,campaigns]);
 useEffect(()=>{
  if(!config.publicKey)return;

  let active=true;
  let configured=false;
  let failed=false;
  let timeoutId=null;

  setCardReady(false);
  setNotice("");

  // Cache-bust Collect.js on each fresh initialization so mobile Safari does not reuse a stale/partial gateway script.
  const scriptUrl="https://secure.nmi.com/token/Collect.js?v="+Date.now();
  const prepareScript=script=>{
   // Use explicit attribute names: Collect.js reads these attributes during
   // script initialization, so they must exist before the script is inserted.
   script.setAttribute("data-litix-paykings-collect","true");
   // NMI's JavaScript-based activation expects the tokenization key on the
   // script tag; the remaining settings and hosted-field selectors are passed
   // to CollectJS.configure below. Avoid mixing auto-activation attributes
   // with the explicit JavaScript configuration path.
   script.setAttribute("data-tokenization-key",config.publicKey);
   script.setAttribute("data-variant","inline");
   script.setAttribute("data-style-sniffer","false");
   script.setAttribute("data-field-ccnumber-selector","#ccnumber");
   script.setAttribute("data-field-ccexp-selector","#ccexp");
   script.setAttribute("data-field-cvv-selector","#cvv");
   return script;
  };

  const fail=message=>{
   if(!active||configured)return;
   failed=true;
   if(timeoutId!==null)window.clearTimeout(timeoutId);
   setCardReady(false);
   setNotice(message);
  };

  let pollId=null;
  let pollStartedAt=0;
  const configureCollectJS=()=>{
   if(!active||configured||pollId!==null)return;
   pollStartedAt=Date.now();
   const pollForApiAndFields=()=>{
    if(!active||configured){if(pollId!==null)window.clearInterval(pollId);pollId=null;return;}
    const apiReady=!!getCollectJS()&&typeof getCollectJS().configure==="function";
    const fields=["ccnumber","ccexp","cvv"].map(id=>document.getElementById(id));
    const fieldsReady=fields.every(el=>el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=="hidden");
    if(apiReady&&fieldsReady){
     if(pollId!==null)window.clearInterval(pollId);
     pollId=null;
     initializeCollectJS();
     return;
    }
    if(Date.now()-pollStartedAt>=12000){
     if(pollId!==null)window.clearInterval(pollId);
     pollId=null;
     fail(!apiReady
      ?"PayKings loaded, but Collect.js did not expose its configuration API after initialization. Retry secure fields."
      :"Secure card fields are not mounted yet. Retry secure fields when the checkout form is visible.");
    }
   };
   pollForApiAndFields();
   if(active&&!configured&&pollId===null)pollId=window.setInterval(pollForApiAndFields,100);
  };

  const initializeCollectJS=()=>{
   if(!active||!getCollectJS()||typeof getCollectJS().configure!=="function")return;
   // Start the readiness deadline after the library is available; downloading
   // Collect.js is not proof that the hosted card iframes have mounted.
   if(timeoutId!==null)window.clearTimeout(timeoutId);
   timeoutId=window.setTimeout(()=>{
    fail("PayKings loaded, but its secure input frames did not become ready within 15 seconds. Please retry secure fields.");
   },15000);

   try{
    getCollectJS().configure({
     variant:"inline",
     styleSniffer:false,
     customCss:{"font-size":"16px","font-family":"sans-serif",color:"#ffffff","background-color":"transparent"},
     placeholderCss:{color:"#aebfd4"},
     validCss:{color:"#4ade80"},
     invalidCss:{color:"#fb7185"},
     fields:{
      ccnumber:{selector:"#ccnumber",title:"Card Number",placeholder:"Card number"},
      ccexp:{selector:"#ccexp",title:"Expiration Date",placeholder:"MM / YY"},
      cvv:{selector:"#cvv",title:"Security Code",placeholder:"CVV"}
     },
     callback:r=>{
      if(!active)return;
      if(r?.token)done.current?.(r.token);
      else{
       setNotice("Secure card tokenization failed. Check the card fields and try again.");
       setBusy(false);
      }
     },
     fieldsAvailableCallback:()=>{
      if(!active||configured)return;
      configured=true;
      if(timeoutId!==null)window.clearTimeout(timeoutId);
      setCardReady(true);
      setNotice("");
     }
    });
   }catch{
    fail("PayKings loaded but could not initialize its secure card fields. Verify the public tokenization key and gateway configuration.");
   }
  };

  const onLoad=()=>{
   if(!active)return;
   const loadedScript=document.querySelector('script[data-litix-paykings-collect="true"]');
   if(loadedScript)loadedScript.dataset.litixLoaded="true";
   configureCollectJS();
  };
  const onError=()=>{
   if(script)script.dataset.litixFailed="true";
   fail("PayKings Collect.js could not load. Check the gateway URL and network access.");
  };

  let script=document.querySelector('script[data-litix-paykings-collect="true"]');
  const scriptWasAlreadyPresent=!!script;
  // Cover download stalls as well as iframe initialization.
  timeoutId=window.setTimeout(()=>{
   if(script)script.dataset.litixFailed="true";
   fail("PayKings secure script did not finish loading. Please retry secure fields.");
  },15000);
  if(getCollectJS()?.configure){
   // Reuse the already-loaded library; never inject a second copy.
   if(script?.dataset.tokenizationKey && script.dataset.tokenizationKey!==config.publicKey){
    fail("PayKings is already loaded with a different tokenization key. Refresh checkout to load the correct configuration.");
   }else{
    if(script)prepareScript(script);
    configureCollectJS();
   }
  }else{
   // A script added by older code may have already fired load before this
   // effect attached listeners, or may lack the key attribute entirely.
   // Replace only that stale, not-yet-initialized script, then set every
   // required data attribute BEFORE inserting the script into the document.
   // A previously loaded script can fire "load" without exposing CollectJS.configure
   // (for example, an interrupted/partially initialized stale copy). Do not reuse
   // a completed script that has no API or was loaded with a different key.
   if(script && !getCollectJS()?.configure && (script.dataset.tokenizationKey!==config.publicKey || script.dataset.litixLoaded==="true")){script.remove();script=null;}
   if(script?.dataset.litixFailed==="true"){script.remove();script=null;}
   if(!script){
    document.querySelectorAll('script[src*="secure.nmi.com/token/Collect.js"]').forEach(staleScript=>staleScript.remove());
    script=document.createElement("script");
    script.src=scriptUrl;
    script.async=true;
   }else if(script.dataset.tokenizationKey && script.dataset.tokenizationKey!==config.publicKey){
    script.remove();
    script=document.createElement("script");
    script.src=scriptUrl;
    script.async=true;
   }
   prepareScript(script);
   script.addEventListener("load",onLoad,{once:true});
   script.addEventListener("error",onError,{once:true});
   if(!script.isConnected)document.head.appendChild(script);
   // Begin bounded polling immediately after insertion. Do not depend on the
   // load event to kick off readiness checks: a cached/SPA-loaded script can
   // complete before listeners attach, and some builds expose the API later.
   configureCollectJS();
  }

  return ()=>{
   active=false;
   if(failed&&script&&!getCollectJS()?.configure)script.dataset.litixFailed="true";
   if(timeoutId!==null)window.clearTimeout(timeoutId);
   if(pollId!==null)window.clearInterval(pollId);
   script?.removeEventListener("load",onLoad);
   script?.removeEventListener("error",onError);
  };
 },[config.ready,config.publicKey,cardRetry]);
 const price=selected?Math.ceil(selected.per1000*qty/1000*100):0;
 async function purchase(token){try{const r=await fetch("/api/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({serviceId:selected.id,quantity:qty,email,link,paymentToken:token,idempotencyKey:key,expectedAmountCents:price})});const v=await r.json();if(r.status!==202)setKey(crypto.randomUUID());if(!r.ok&&r.status!==202)throw Error(v.error||"Payment processing failed");setReceipt(v);setNotice(v.message);if(v.orderId&&v.secret){const trackingUrl=location.origin+"/?track="+encodeURIComponent(v.orderId)+"&token="+encodeURIComponent(v.secret);setPrivateUrl(trackingUrl);setSavedOrders(old=>[{id:v.orderId,url:trackingUrl,createdAt:new Date().toISOString(),payment:v.payment,fulfillment:v.fulfillment||"pending"},...old.filter(o=>o.id!==v.orderId)].slice(0,12));}}catch(e){setNotice(e.message)}finally{setBusy(false)}}
 done.current=purchase;
 const submit=e=>{e.preventDefault();if(!selected||busy)return;if(price<500){setNotice("Orders must total at least $5.00.");return}if(!cardReady)return;if(!Number.isSafeInteger(qty)||qty<selected.min||qty>selected.max){setNotice("Enter a whole-number quantity within this service’s limits.");return}if(!selected.purchasable){setNotice("This service requires additional supplier fields and cannot be checked out here.");return}setBusy(true);setNotice("");try{getCollectJS().startPaymentRequest()}catch{setBusy(false);setNotice("Complete your secure card fields before paying")}};
 const track=async value=>{try{const u=new URL(value,location.origin),id=u.searchParams.get("track"),token=u.searchParams.get("token");if(!id||!token)throw Error("Paste the full private tracking URL");const r=await fetch("/api/track?id="+encodeURIComponent(id)+"&token="+encodeURIComponent(token)),v=await r.json();if(!r.ok)throw Error(v.error||"Tracking failed");setTracked(v.order)}catch(e){setNotice(e.message)}};
 useEffect(()=>{if(location.search.includes("track=")){setPrivateUrl(location.href);track(location.href)}},[]);
 return <main className="wrap"><nav className="nav"><a className="brand" href="/" aria-label="Litix home"><img src="/assets/brand/logo.svg" alt="Litix" className="brand-logo" /><span className="brand-wordmark">LITIX<span className="brand-submark">ANALYTICS AMPLIFIED</span></span></a><div><a href="#services">Services</a><a href="#checkout">Checkout</a><a href="#tracking">Track</a><a href="#growth-studio">Growth OS</a></div></nav>
 <section className="hero"><div className="hero-brandline"><span className="hero-orb" aria-hidden="true">L</span><div><div className="eyebrow">LITIX PLATINUM · DIGITAL COMMERCE</div><div className="hero-motto">ANALYTICS AMPLIFIED · INNOVATION IGNITED</div></div></div><h1>Analytics Amplified. Innovation Ignited.</h1><p>Instant Delivery. Programmatic Refills. Stealth Execution.</p><div className="tags"><span>✦ Analytics Amplified</span><span>◇ Innovation Ignited</span><span>✧ Metrics that Move</span><span>◆ Data Driven Discovery</span><span>✧ Instant Delivery</span><span>◆ Programmatic Refills</span><span>↗ Stealth Execution</span><span>✦ Live supplier catalog</span><span>◇ PayKings tokenized cards</span><span>↗ Order status tracking</span><span>◆ No social account passwords</span></div></section>
 <div className="cols"><section id="services" className="panel"><div className="kicker">FULL SUPPLIER CATALOG</div><h2>Browse services</h2><p className="muted small">{catalogState==="ready"?count.toLocaleString()+" SmmGlob services listed":catalogState==="error"?"Supplier catalog connection needs attention":"Connecting securely to SmmGlob..."}</p><div className="catalog-status" role="status"><span className={"status-dot "+catalogState}></span><span>{catalogState==="ready"?"Live catalog connected":catalogState==="error"?"Live catalog temporarily unavailable":"Checking supplier catalog"}</span>{catalogState!=="loading"&&<button type="button" className="catalog-retry" onClick={()=>setCatalogRetry(v=>v+1)}>{catalogState==="error"?"Retry connection":"Refresh catalog"}</button>}</div><div className="filters"><input aria-label="Service search" placeholder="Search services or networks" value={query} onChange={e=>{setQuery(e.target.value);setPg(1)}}/><select aria-label="Categories" value={cat} onChange={e=>{setCat(e.target.value);setPg(1)}}><option value="">All categories</option>{categories.map(c=><option value={c} key={c}>{c}</option>)}</select><select aria-label="Platform" value={platform} onChange={e=>{setPlatform(e.target.value);setPg(1)}}><option>All platforms</option><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Other</option></select><label className="small"><input type="checkbox" checked={favoritesOnly} onChange={e=>setFavoritesOnly(e.target.checked)}/> Saved only</label></div>
 <div className="cards">{services.filter(s=>{const label=(s.name+" "+s.category).toLowerCase();const p=/instagram|\big\b/.test(label)?"Instagram":/tiktok/.test(label)?"TikTok":/youtube/.test(label)?"YouTube":"Other";return (platform==="All platforms"||p===platform)&&(!favoritesOnly||favorites.some(f=>String(f.id)===String(s.id))) }).map(s=><div className="service-option" key={s.id}><button className={"item"+(selected?.id===s.id?" active":"")} aria-pressed={selected?.id===s.id} aria-label={"Select "+s.name+", "+money(Math.ceil(s.per1000*100))+" per 1,000"} onClick={()=>{setSelected(s);setQty(s.min);setReceipt(null);setRecentServices(old=>[s,...old.filter(x=>x.id!==s.id)].slice(0,8));document.getElementById("checkout")?.scrollIntoView({behavior:"smooth"})}}><div className="cat">{s.category}</div><div className="itemname">{s.name}</div><div className="foot"><span className="price">{money(Math.ceil(s.per1000*100))}<span className="small"> / 1k</span></span><span className="tag">#{s.id}</span></div><div className="service-badges"><span className="tag">{s.min.toLocaleString()}–{s.max.toLocaleString()} units</span><span className="tag">{s.refill?"Refill support":"No refill"}</span><span className="tag">{s.noDrop?"Non-Drop":"No Non-Drop claim"}</span></div></button><label className="compare-toggle"><input type="checkbox" checked={compareIds.includes(String(s.id))} onChange={e=>setCompareIds(old=>e.target.checked?(old.length<3?[...old,String(s.id)]:old):old.filter(id=>id!==String(s.id)))}/> Compare (up to 3)</label></div>)}</div>{compareIds.length>0&&<div className="comparison-panel" aria-live="polite"><h3>Service comparison ({compareIds.length}/3)</h3><div className="comparison-grid">{compareIds.map(id=>{const s=services.find(x=>String(x.id)===id)||favorites.find(x=>String(x.id)===id);return s?<article key={id}><b>{s.name}</b><p>{s.category}</p><p>{money(Math.ceil(s.per1000*100))} / 1,000</p><p>{Number(s.min).toLocaleString()}–{Number(s.max).toLocaleString()} units</p><p>{s.refill?"Refill support":"No refill claim"}</p><p>{s.noDrop?"Non-Drop indicated":"No Non-Drop claim"}</p><button type="button" className="alt" onClick={()=>{setSelected(s);setQty(s.min);document.getElementById("checkout")?.scrollIntoView({behavior:"smooth"})}}>Choose service</button></article>:null})}</div><button type="button" className="alt" onClick={()=>setCompareIds([])}>Clear comparison</button></div>}{!services.length&&<div className="msg" role="status" aria-live="polite">{catalogState==="error"?"We can’t load live prices right now. Please retry shortly. Prices are never guessed, and no order has been placed.":notice||"No services match these filters."}{catalogState==="error"&&<div><button type="button" className="alt" style={{marginTop:12}} onClick={()=>setCatalogRetry(v=>v+1)}>Retry live catalog</button></div>}</div>}<div className="pager"><button className="alt" disabled={pg===1} onClick={()=>setPg(pg-1)}>Previous</button><span className="small">Page {pg} · {total.toLocaleString()} results</span><button className="alt" disabled={pg*24>=total} onClick={()=>setPg(pg+1)}>Next</button></div></section>
 <section id="checkout" className="panel sticky"><div className="kicker">SECURE PAYKINGS CHECKOUT</div><h2>Your order</h2><ol className="checkout-steps" aria-label="Checkout steps"><li className={selected?"step-done":"step-current"}>1. Choose service</li><li className={selected&&link?"step-current":"step-pending"}>2. Order details</li><li className={cardReady?"step-done":"step-pending"}>3. Secure payment</li></ol><p className="checkout-hint">You’ll review the final USD total before paying. Card details are entered securely with PayKings.</p><form onSubmit={submit} className="form"><label>Service<input readOnly value={selected?.name||"Select a service"} /></label>{selected&&<div className="selected-service-meta"><span>{selected.min.toLocaleString()}–{selected.max.toLocaleString()} units</span><span>Service #{selected.id}</span><span>{selected.refill?"Refill eligible":"Standard service"}</span><span>{money(Math.ceil(selected.per1000*100))} / 1,000</span></div>}<label>Public post or profile URL<input type="url" required value={link} placeholder="https://..." onChange={e=>setLink(e.target.value)}/></label><label>Quantity<input type="number" min={selected?.min||1} max={selected?.max||1000000} required value={qty} onChange={e=>setQty(Number(e.target.value))}/></label><label>Email<input type="email" required placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><div className="totalbox"><div className="small">Final price in USD</div><div className="total">{money(price)}</div><div className="small">Verified before submitting payment</div></div><PremiumInlineCheckout cardReady={cardReady} busy={busy} canPay={!!selected&&!!selected.purchasable&&!busy&&config.ready&&price>=500} buttonLabel={busy?"Processing securely...":!config.ready?"Card checkout awaiting configuration":!cardReady?"Loading card fields...":price<500?"Minimum order $5.00":!selected?.purchasable?"Special supplier fields required":"Pay "+money(price)+" securely"}/>{selected&&!selected.purchasable&&<p className="small">This supplier service requires special order fields not yet supported by the basic service API.</p>}<p className="small">PayKings handles raw card details, not Litix.</p>{config.ready&&!cardReady&&<button type="button" className="alt" onClick={()=>{setNotice("Retrying secure card fields…");setCardRetry(v=>v+1)}}>Retry secure fields</button>}</form>{notice&&<div className="msg" role="status" aria-live="polite">{notice}</div>}{config.ready&&!cardReady&&<div className="checkout-help"><b>Having trouble entering card details?</b><p className="small">Retry the secure fields first. If they still do not load, contact Litix support and mention “PayKings card fields”. Never send card numbers or security codes in chat.</p><a className="support-link" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need checkout help. The PayKings secure card fields are not loading on my mobile device.")} target="_blank" rel="noopener noreferrer">Get checkout help ↗</a></div>}{receipt&&<div className="msg"><b>{receipt.orderId}</b><p>{receipt.payment} · {receipt.fulfillment||"pending"}</p>{receipt.secret&&<><input readOnly value={privateUrl}/><button className="alt" style={{marginTop:12}} onClick={()=>navigator.clipboard.writeText(privateUrl)}>Copy tracking link</button></>}</div>}</section></div>
 <section className="panel growth-studio" id="growth-studio"><div className="kicker">LITIX GROWTH OS</div><h2>Turn your goal into a growth plan</h2><p className="muted">A practical planning workspace for creators, businesses, and agencies. Recommendations are planning guidance—not guaranteed results or live account analytics.</p><div className="growth-controls"><label>Your role<select value={industry} onChange={e=>setIndustry(e.target.value)}><option>Personal brand</option><option>Creator</option><option>Influencer</option><option>Agency</option><option>Small business</option><option>Brand / enterprise</option></select></label><label>Primary goal<select value={growthGoal} onChange={e=>setGrowthGoal(e.target.value)}><option>Grow audience</option><option>Increase engagement</option><option>Launch a product</option><option>Generate leads</option><option>Build brand awareness</option><option>Improve content consistency</option></select></label><label>Planning horizon<select value={planDays} onChange={e=>setPlanDays(e.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label><button className="primary" type="button" onClick={()=>setPlanGenerated(true)}>Build my plan</button></div>{planGenerated&&<div className="growth-plan" aria-live="polite"><h3>{planDays}-day plan · {growthGoal}</h3><ol><li><b>Set a baseline:</b> record current reach, engagement, clicks or leads relevant to your goal.</li><li><b>Build a repeatable schedule:</b> choose 3 content themes for your {industry.toLowerCase()} audience and publish consistently.</li><li><b>Test and learn:</b> compare formats, hooks, posting windows, and calls to action using available platform analytics.</li><li><b>Review weekly:</b> keep the strongest-performing ideas, improve weak ones, and document the next experiment.</li><li><b>At day {planDays}:</b> compare results against your baseline and set the next measurable target.</li></ol><button type="button" className="alt" onClick={()=>GenUIcopy("Litix "+planDays+"-day growth plan\nAudience: "+industry+"\nGoal: "+growthGoal+"\n1. Record a baseline.\n2. Plan three content themes and a consistent schedule.\n3. Test formats and calls to action.\n4. Review weekly using actual analytics.\n5. Compare results at day "+planDays+".")}>Copy plan</button></div>}</section><section className="panel campaign-studio" id="campaign-studio"><div className="kicker">CAMPAIGN WORKSPACE</div><h2>Organize your next campaign</h2><p className="muted">Create a lightweight campaign checklist saved in this browser. Team collaboration and shared cloud storage can be added in the account phase.</p><form className="campaign-form" onSubmit={e=>{e.preventDefault();if(!campaignName.trim())return;setCampaigns(old=>[{id:Date.now(),name:campaignName.trim(),goal:growthGoal,status:"Planning",createdAt:new Date().toISOString()},...old].slice(0,20));setCampaignName("")}}><input aria-label="Campaign name" placeholder="e.g. Summer product launch" value={campaignName} onChange={e=>setCampaignName(e.target.value)} maxLength={100} required/><button className="primary" type="submit">Create campaign</button></form>{campaigns.length?campaigns.map(c=><div className="workspace-row" key={c.id}><div className="workspace-link">{c.name}<small>{c.goal} · Created {new Date(c.createdAt).toLocaleDateString()}</small></div><select aria-label={"Status for "+c.name} value={c.status} onChange={e=>setCampaigns(old=>old.map(x=>x.id===c.id?{...x,status:e.target.value}:x))}><option>Planning</option><option>In progress</option><option>Review</option><option>Completed</option></select><button className="icon-action" aria-label={"Delete "+c.name} onClick={()=>setCampaigns(old=>old.filter(x=>x.id!==c.id))}>×</button></div>):<p className="small muted">Your campaigns will appear here.</p>}</section><section className="panel workspace" id="workspace"><div className="kicker">YOUR LITIX WORKSPACE</div><h2>Welcome to your workspace</h2><p className="muted small">Your saved items and tracking links are stored in this browser only. This is a convenience dashboard, not a signed-in account.</p><div className="workspace-grid"><article><h3>Saved services</h3>{favorites.length?favorites.map(s=><div className="workspace-row" key={s.id}><button className="workspace-link" onClick={()=>{setSelected(s);setQty(s.min);document.getElementById("checkout")?.scrollIntoView({behavior:"smooth"})}}>{s.name}<small>{s.category} · #{s.id}</small></button><button className="icon-action" aria-label={"Remove "+s.name+" from favorites"} onClick={()=>setFavorites(old=>old.filter(x=>x.id!==s.id))}>×</button></div>):<p className="small muted">Save services you want to find again using the action below.</p>}{services.slice(0,8).map(s=><button key={s.id} className="save-service" onClick={()=>setFavorites(old=>old.some(x=>x.id===s.id)?old.filter(x=>x.id!==s.id):[{id:s.id,name:s.name,category:s.category,min:s.min,max:s.max,per1000:s.per1000,refill:s.refill,purchasable:s.purchasable},...old].slice(0,12))}>{favorites.some(x=>x.id===s.id)?"★ Saved":"☆ Save"} · {s.name}</button>)}</article><article><h3>Recent services</h3>{recentServices.length?recentServices.map(s=><button key={s.id} className="workspace-row workspace-link" onClick={()=>{setSelected(s);setQty(s.min);document.getElementById("checkout")?.scrollIntoView({behavior:"smooth"})}}>{s.name}<small>{s.category} · #{s.id}</small></button>):<p className="small muted">Services you select will appear here.</p>}</article><article><h3>Order tracking links</h3>{savedOrders.length?savedOrders.map(o=><div className="workspace-row" key={o.id}><button className="workspace-link" onClick={()=>{setPrivateUrl(o.url);document.getElementById("tracking")?.scrollIntoView({behavior:"smooth"});track(o.url)}}>{o.id}<small>{o.payment} · {o.fulfillment} · {new Date(o.createdAt).toLocaleDateString()}</small></button><button className="icon-action" aria-label={"Copy tracking link for "+o.id} onClick={()=>navigator.clipboard?.writeText(o.url)}>⧉</button></div>):<p className="small muted">Your tracking links will appear here after an order is submitted in this browser.</p>}</article></div><p className="small muted">For privacy, avoid using shared devices. Clearing browser storage removes these saved items; keep a separate copy of your private tracking links.</p></section><section className="panel support-banner"><div className="support-copy"><div className="kicker">LITIX CONCIERGE</div><h2>Real support. A premium experience.</h2><p>Questions about an order? Our support channel is here to help you move forward with confidence.</p><div className="support-actions"><a className="support-link" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need help with an order.")} target="_blank" rel="noopener noreferrer">Order help ↗</a><a className="support-link" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I have a payment or checkout question.")} target="_blank" rel="noopener noreferrer">Payment help ↗</a><a className="support-link" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I have a question about a service before ordering.")} target="_blank" rel="noopener noreferrer">Service questions ↗</a></div></div><div className="support-emblem" aria-hidden="true">L<span>✦</span></div></section><section className="panel tracking" id="tracking"><div className="kicker">ORDER VISIBILITY</div><h2>Track your order</h2><div className="trackingbox"><input aria-label="Tracking link" placeholder="Paste private tracking URL" value={privateUrl} onChange={e=>setPrivateUrl(e.target.value)}/><button className="primary" onClick={()=>track(privateUrl)}>Check status</button></div>{tracked&&<div className="msg" role="status" aria-live="polite"><b>{tracked.id}</b><p>{tracked.service} · {tracked.quantity} units · USD {tracked.amount}</p><p>Payment: {tracked.payment} · Fulfillment: {tracked.fulfillment} · Supplier: {tracked.status||"Pending"}</p></div>}</section><section className="panel trust-panel" id="how-it-works"><div className="kicker">THE LITIX STANDARD</div><h2>Built for a smoother experience</h2><div className="trust-grid"><article><span className="trust-symbol">01</span><h3>Choose your service</h3><p>Search the catalog, filter by category, and check the published quantity limits before selecting an option.</p></article><article><span className="trust-symbol">02</span><h3>Submit a public URL</h3><p>Use the eligible public profile or post link requested by the service. Litix never needs your social account password.</p></article><article><span className="trust-symbol">03</span><h3>Track progress</h3><p>Keep your private tracking link. It shows the latest order and supplier status when tracking data is available.</p></article></div><div className="service-note"><strong>Service availability varies.</strong> Delivery times, refill eligibility, and supported links depend on the specific supplier service. A listed service is not a guarantee of a particular outcome or platform reach.</div></section><section className="panel faq-panel" id="faq"><div className="kicker">HELP CENTER</div><h2>Frequently asked questions</h2><details><summary>What information do I need to place an order?</summary><p>Usually a supported public profile or post URL, the quantity you choose within the service limits, and an email address for order support.</p></details><details><summary>Do you need my social media password?</summary><p>No. Never share your social account password, login code, or recovery details with Litix or a supplier.</p></details><details><summary>Where can I check my order?</summary><p>Use the private tracking URL shown after your order is submitted. Save it somewhere secure; anyone with that private link may be able to view the order status.</p></details><details><summary>Why might a service or order status be unavailable?</summary><p>Supplier catalogs and status updates depend on third-party systems. If the catalog is temporarily unavailable, wait and retry later rather than repeatedly submitting the same order.</p></details><details><summary>How do I get help?</summary><p>Contact the Litix WhatsApp Concierge using the support link on this page. Share only the order ID and details needed to locate the issue—never card details, security codes, or passwords.</p></details><div className="faq-links"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/refunds">Refunds & Order Issues</a></div></section><footer className="end"><span>LITIX · Analytics Amplified. Innovation Ignited. · Metrics that Move · Data Driven Discovery</span><span>Powered by SmmGlob · Secure checkout</span><span className="legal-links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refunds">Refunds</a></span><a href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need help with an order.")} target="_blank" rel="noopener noreferrer">WhatsApp Concierge</a></footer><a className="whatsapp-float" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need help with an order.")} target="_blank" rel="noopener noreferrer" aria-label="Chat with Litix on WhatsApp"><span className="whatsapp-icon" aria-hidden="true">☏</span><span>Chat with us</span></a></main>
}
