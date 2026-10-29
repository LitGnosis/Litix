
"use client";
import {useEffect,useRef,useState} from "react";
import PremiumInlineCheckout from "../components/PremiumInlineCheckout";
import GrowthBundles from "../components/GrowthBundles";
import {restrictedSocialKind} from "../lib/publicBoosteroOnly.mjs";
import {sortServicesPer1000} from "../lib/catalogSort.mjs";
import {publicServiceCardName} from "../lib/serviceCardDisplay.mjs";
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",currencyDisplay:"code"}).format(n/100);
const cardMoney=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n/100); // display-only: preserve stored cents
// Collect.js is documented as a global named CollectJS. Some script builds expose
// that binding without a window property, so resolve both forms consistently.
const getCollectJS=()=>{try{if(typeof CollectJS!=="undefined")return CollectJS}catch{};return typeof window!=="undefined"?window.CollectJS:undefined};
const validOrderDetails=(service,url,email,quantity)=>{
 try{const u=new URL(url);return !!service?.purchasable&&["https:","http:"].includes(u.protocol)&&!u.username&&!u.password&&u.hostname.includes(".")&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&Number.isSafeInteger(quantity)&&quantity>=service.min&&quantity<=service.max&&Number.isSafeInteger(Number(service.unitStep||1))&&((quantity-Number(service.supplierMin??service.min))%Number(service.unitStep||1)===0)&&Math.ceil(service.per1000*quantity/10-1e-8)>=500}catch{return false}
};
const whatsappNumber=(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||"").replace(/\D/g,"");
const publicCollectKey=process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||"";
const socialPlatformForService=service=>{
 // Supplier listings may describe Followers in the category rather than the service name.
 // Never infer a profile-level service from a Likes/Views/Post category alone.
 const label=[service?.name,service?.category].map(v=>String(v||"")).join(" ").toLowerCase();
 if(!/\bfollow(?:er)?s?\b/.test(label))return "";
 if(/instagram|(?:^|[^a-z])ig(?:[^a-z]|$)/.test(label))return "instagram";
 if(/tik[\s._-]*tok/.test(label))return "tiktok";
 return "";
};
const normalizeSocialProfileInput=(value,platform)=>{
 const raw=String(value||"").trim();
 if(!platform)return {ok:true,value:raw};
 if(!raw)return {ok:false,error:"Enter a public "+(platform==="instagram"?"Instagram":"TikTok")+" username or profile link."};
 let username=raw;
 const input=/^(?:www\.)?(?:instagram\.com|tiktok\.com)\//i.test(raw)?"https://"+raw:raw;
 if(/^https?:\/\//i.test(input)){
  let url;try{url=new URL(input)}catch{return {ok:false,error:"Enter a valid public profile URL or @username."}}
  if(url.protocol!=="https:"||url.username||url.password)return {ok:false,error:"Use a secure public profile link (https://)."};
  const host=url.hostname.toLowerCase().replace(/^www\./,"");
  if(platform==="instagram"&&host!=="instagram.com")return {ok:false,error:"Use an Instagram username or instagram.com profile URL."};
  if(platform==="tiktok"&&host!=="tiktok.com")return {ok:false,error:"Use a TikTok username or tiktok.com profile URL."};
  const match=platform==="instagram"?url.pathname.match(/^\/([A-Za-z0-9._]+)\/?$/):url.pathname.match(/^\/@([A-Za-z0-9._]+)\/?$/);
  if(!match)return {ok:false,error:"Enter a direct public profile URL, not a post or video URL."};
  username=match[1];
 }else{
  username=raw.replace(/^@/,"");
 }
 const valid=platform==="instagram"?/^[A-Za-z0-9._]{1,30}$/.test(username):/^[A-Za-z0-9._]{2,24}$/.test(username);
 if(!valid)return {ok:false,error:"That username format is not valid for this platform."};
 return {ok:true,username,url:platform==="instagram"?"https://www.instagram.com/"+username+"/":"https://www.tiktok.com/@"+username};
};
export default function Home(){
 const GenUIcopy=text=>{if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text)};
 const [services,setServices]=useState([]),[categories,setCategories]=useState([]),[favorites,setFavorites]=useState([]),[recentServices,setRecentServices]=useState([]),[savedOrders,setSavedOrders]=useState([]),[workspaceReady,setWorkspaceReady]=useState(false),[growthGoal,setGrowthGoal]=useState("Grow audience"),[industry,setIndustry]=useState("Creator"),[planDays,setPlanDays]=useState("30"),[planGenerated,setPlanGenerated]=useState(false),[campaignName,setCampaignName]=useState(""),[campaigns,setCampaigns]=useState([]),[cat,setCat]=useState(""),[query,setQuery]=useState(""),[platform,setPlatform]=useState("All platforms"),[quickKind,setQuickKind]=useState(""),[favoritesOnly,setFavoritesOnly]=useState(false),[compareIds,setCompareIds]=useState([]),[pg,setPg]=useState(1),[catalogRetry,setCatalogRetry]=useState(0),[catalogState,setCatalogState]=useState("loading"),[catalogSource,setCatalogSource]=useState("unavailable"),[count,setCount]=useState(0),[total,setTotal]=useState(0),[selected,setSelected]=useState(null),[qty,setQty]=useState(100),[email,setEmail]=useState(""),[link,setLink]=useState(""),[config,setConfig]=useState({ready:false}),[cardReady,setCardReady]=useState(false),[cardRetry,setCardRetry]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[receipt,setReceipt]=useState(null),[privateUrl,setPrivateUrl]=useState(""),[tracked,setTracked]=useState(null),[key,setKey]=useState("");const done=useRef(null);
 const [planServices,setPlanServices]=useState([]),[planStatus,setPlanStatus]=useState("");
 const isCurrentCard=s=>String(s?.id||"").startsWith("boostero_")&&s?.purchasable===true&&services.some(a=>a.id===s.id&&a.purchasable===true);
 async function buildPlan(){setPlanGenerated(true);setPlanServices([]);setPlanStatus("Finding available services…");try{const q=new URLSearchParams({goal:growthGoal,horizon:planDays});const r=await fetch("/api/catalog/v1?"+q,{signal:AbortSignal.timeout(12000)});const v=await r.json();if(!r.ok)throw Error();setPlanServices(v.recommendations||[]);setPlanStatus(v.recommendations?.length?"Review a suggested service before ordering. The planning horizon does not schedule supplier delivery.":"No matching services are currently available.")}catch{setPlanStatus("Service recommendations are temporarily unavailable. You can retry Build my plan.")}}
 const profileInput=normalizeSocialProfileInput(link,socialPlatformForService(selected));
 const normalizedOrderLink=profileInput.url||link;
 const detailsReady=profileInput.ok&&validOrderDetails(selected,normalizedOrderLink,email,qty);
 useEffect(()=>{setKey(crypto.randomUUID());try{setFavorites(JSON.parse(localStorage.getItem("litix:favorites")||"[]"));setRecentServices(JSON.parse(localStorage.getItem("litix:recent-services")||"[]"));setSavedOrders(JSON.parse(localStorage.getItem("litix:saved-orders")||"[]"));setCampaigns(JSON.parse(localStorage.getItem("litix:campaigns")||"[]"))}catch{}setWorkspaceReady(true);fetch("/api/config").then(r=>r.json()).then(v=>setConfig({...v,publicKey:v.publicKey||publicCollectKey,ready:!!(v.ready&& (v.publicKey||publicCollectKey))})).catch(()=>setConfig({ready:false,publicKey:publicCollectKey||""}))},[]);
 useEffect(()=>{const abort=new AbortController(),p=new URLSearchParams({category:cat,q:query,page:String(pg),platform,kind:quickKind});setCatalogState("loading");const deadline=setTimeout(()=>abort.abort("timeout"),42000);fetch("/api/catalog/v1?"+p,{signal:abort.signal}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Supplier catalog temporarily unavailable");return v}).then(v=>{setServices(v.items||[]);setCategories(v.categories||[]);setCount(v.allCount||0);setTotal(v.total||0);setCatalogSource(v.catalogStatus==="live"?"live":"cached");setCatalogState("ready");if(v.error)setNotice(v.error)}).catch(e=>{if(!abort.signal.aborted||abort.signal.reason==="timeout"){setCatalogSource("unavailable");setCatalogState("error");setNotice("The supplier catalog is temporarily unavailable. Please retry in a moment; no order has been placed.")}}).finally(()=>clearTimeout(deadline));return()=>{clearTimeout(deadline);abort.abort()}},[cat,query,pg,platform,quickKind,catalogRetry]);
 useEffect(()=>{if(!workspaceReady)return;try{localStorage.setItem("litix:favorites",JSON.stringify(favorites));localStorage.setItem("litix:recent-services",JSON.stringify(recentServices.slice(0,8)));localStorage.setItem("litix:saved-orders",JSON.stringify(savedOrders.slice(0,12)));localStorage.setItem("litix:campaigns",JSON.stringify(campaigns.slice(0,20)))}catch{}},[workspaceReady,favorites,recentServices,savedOrders,campaigns]);
 useEffect(()=>{
  if(!config.publicKey||!config.ready||!detailsReady){setCardReady(false);return;}

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
   script.id="litix-paykings-collect";
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
   const loadedScript=document.querySelector('script#litix-paykings-collect');
   if(loadedScript)loadedScript.__litixLoaded="true";
   configureCollectJS();
  };
  const onError=()=>{
   if(script)script.__litixFailed="true";
   fail("PayKings Collect.js could not load. Check the gateway URL and network access.");
  };

  let script=document.querySelector('script#litix-paykings-collect');
  const scriptWasAlreadyPresent=!!script;
  // Cover download stalls as well as iframe initialization.
  timeoutId=window.setTimeout(()=>{
   if(script)script.__litixFailed="true";
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
   if(script && !getCollectJS()?.configure && (script.dataset.tokenizationKey!==config.publicKey || script.__litixLoaded==="true")){script.remove();script=null;}
   if(script?.__litixFailed==="true"){script.remove();script=null;}
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
   if(failed&&script&&!getCollectJS()?.configure)script.__litixFailed="true";
   if(timeoutId!==null)window.clearTimeout(timeoutId);
   if(pollId!==null)window.clearInterval(pollId);
   script?.removeEventListener("load",onLoad);
   script?.removeEventListener("error",onError);
  };
 },[config.ready,config.publicKey,cardRetry,detailsReady]);
 const price=selected?Math.ceil(selected.per1000*qty/10-1e-8):0;
 async function purchase(token){
  try{
   const r=await fetch("/api/checkout/v1",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({serviceId:selected.id,quantity:qty,email,link:normalizedOrderLink,paymentToken:token,idempotencyKey:key,expectedAmountCents:price})});
   const v=await r.json();
   // Ambiguous checkout outcomes reuse the original idempotency key to avoid accidental duplicate charges.
   if(!r.ok&&r.status!==202)throw Error(v.error||"Payment processing failed");
   setReceipt(v);setNotice(v.message);
   if(v.orderId&&v.secret){
    const trackingUrl=location.origin+"/?track="+encodeURIComponent(v.orderId)+"&token="+encodeURIComponent(v.secret);
    const item={id:v.orderId,url:trackingUrl,createdAt:new Date().toISOString(),payment:v.payment,fulfillment:v.fulfillment||"pending",quantity:qty,destination:normalizedOrderLink};
    setPrivateUrl(trackingUrl);
    setSavedOrders(old=>[item,...old.filter(o=>o.id!==v.orderId)].slice(0,12));
    try{const saved=JSON.parse(localStorage.getItem("litix:saved-orders")||"[]");localStorage.setItem("litix:saved-orders",JSON.stringify([item,...saved.filter(o=>o.id!==v.orderId)].slice(0,12)))}catch{}
    if(v.payment==="paid"){
     let stored=false;
     try{
      sessionStorage.setItem("litix:last-confirmation",JSON.stringify({orderId:v.orderId,trackingUrl,payment:v.payment,fulfillment:v.fulfillment||"pending",amountCents:price,service:selected?.name||"Social media service",quantity:qty,destination:normalizedOrderLink,createdAt:item.createdAt}));
      stored=true;
     }catch{}
     if(stored){location.assign("/confirmation?order="+encodeURIComponent(v.orderId));return}
    }
   }
  }catch(e){setNotice(e.message)}
  finally{setBusy(false)}
 }
 done.current=purchase;
 const submit=e=>{e.preventDefault();if(!detailsReady||!cardReady||!selected||busy)return;if(!Number.isSafeInteger(qty)||qty<selected.min||qty>selected.max){setNotice("Enter a whole-number quantity within this service’s limits.");return}if(!selected.purchasable){setNotice("This service requires additional supplier fields and cannot be checked out here.");return}setBusy(true);setNotice("");try{getCollectJS().startPaymentRequest()}catch{setBusy(false);setNotice("Complete your secure card fields before paying")}};
 const track=async value=>{try{const u=new URL(value,location.origin),id=u.searchParams.get("track"),token=u.searchParams.get("token");if(!id||!token)throw Error("Paste the full private tracking URL");const r=await fetch("/api/track?id="+encodeURIComponent(id)+"&token="+encodeURIComponent(token)),v=await r.json();if(!r.ok)throw Error(v.error||"Tracking failed");setTracked(v.order)}catch(e){setNotice(e.message)}};
 useEffect(()=>{if(location.search.includes("track=")){setPrivateUrl(location.href);track(location.href)}},[]);
 return <main className="wrap"><nav className="nav"><a className="brand" href="/" aria-label="Litix home"><img src="/assets/brand/litix-logo.webp" alt="Litix — Innovation, Ignited." className="litix-new-logo" /></a><div><a href="#services">Services</a><a href="/global-services">Global Catalog</a><a href="#checkout">Checkout</a><a href="/autolikes">AutoLikes</a><a href="/track">Track Order</a><a href="#growth-studio">Growth OS</a></div></nav>
 <GrowthBundles/>
 <div className="cols"><section id="services" className="panel"><div className="kicker">VERIFIED AVAILABLE SERVICES</div><h2>Browse services</h2><p className="muted small">All prices are in USD (US dollars). Service rates are shown per 1,000 units.</p><div className="litix-network-tabs" aria-label="Service quick filters" role="group">
 {["Instagram","TikTok","All platforms"].map(v=><button type="button" key={v} aria-pressed={platform===v&&!quickKind} className={platform===v&&!quickKind?"litix-network-active":""} onClick={()=>{setPlatform(v);setQuickKind("");setCat("");setQuery("");setFavoritesOnly(false);setPg(1)}}>{v==="All platforms"?"All services":v+" services"}</button>)}
 {["Instagram","TikTok"].flatMap(v=>["Followers","Likes"].map(k=><button type="button" key={v+"-"+k} aria-pressed={platform===v&&quickKind===k.toLowerCase()} className={platform===v&&quickKind===k.toLowerCase()?"litix-network-active":""} onClick={()=>{setPlatform(v);setQuickKind(k.toLowerCase());setCat("");setQuery("");setFavoritesOnly(false);setPg(1)}}>{v} {k}</button>))}
 </div><p className="muted small">{catalogState==="ready"?count.toLocaleString()+" Litix services available · "+total.toLocaleString()+" match current filters":catalogState==="error"?"Supplier catalog connection needs attention":"Checking supplier catalog..."}</p><div className="catalog-status" role="status"><span className={"status-dot "+(catalogState==="ready"&&catalogSource==="cached"?"loading":catalogState)}></span><span>{catalogState==="ready"?(catalogSource==="live"?(total?"Verified services available · ready to order":"No verified services match these filters"):"Checking verified supplier availability"):catalogState==="error"?"Supplier catalog temporarily unavailable":"Checking supplier catalog"}</span>{catalogState!=="loading"&&<button type="button" className="catalog-retry" onClick={()=>setCatalogRetry(v=>v+1)}>{catalogState==="error"||catalogSource==="cached"?"Retry connection":"Refresh catalog"}</button>}</div><div className="filters"><input aria-label="Service search" placeholder="Search services or networks" value={query} onChange={e=>{setQuery(e.target.value);setPg(1)}}/><select aria-label="Categories" value={cat} onChange={e=>{setCat(e.target.value);setPg(1)}}><option value="">All categories</option>{categories.map(c=><option value={c} key={c}>{c}</option>)}</select><select aria-label="Platform" value={platform} onChange={e=>{setPlatform(e.target.value);setQuickKind("");setPg(1)}}><option>All platforms</option><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Facebook</option><option>Spotify</option><option>Other</option></select><label className="small"><input type="checkbox" checked={favoritesOnly} onChange={e=>setFavoritesOnly(e.target.checked)}/> Saved only</label></div>
 <div className="cards">{sortServicesPer1000(services.filter(s=>(!favoritesOnly||favorites.filter(isCurrentCard).some(f=>String(f.id)===String(s.id)))),null,s=>s.per1000).map(s=><div className="service-option" key={s.id}><button className={"item"+(selected?.id===s.id?" active":"")} disabled={s.purchasable===false} aria-pressed={selected?.id===s.id} aria-label={"Select "+publicServiceCardName(s)+", "+cardMoney(Math.ceil(s.per1000*100))+" per 1,000"} onClick={()=>{setSelected(s);setQty(s.min);setReceipt(null);setRecentServices(old=>[s,...old.filter(x=>x.id!==s.id)].slice(0,8));document.getElementById("checkout")?.scrollIntoView({behavior:"smooth"})}}><div className="itemname service-card-name">{publicServiceCardName(s)}</div><div className="foot service-card-foot"><span className="price service-card-price">{cardMoney(Math.ceil(s.per1000*100))}<span className="price-unit service-card-unit"> per 1,000</span></span></div><div className="minimum-price service-card-start">{s.pricingReview||!Number.isFinite(Number(s.startingAmountCents))?"Starting amount unavailable":"Starting at "+cardMoney(s.startingAmountCents)}</div>{s.purchasable===false&&<div className="service-card-unavailable">Unavailable for new orders</div>}</button><label className="compare-toggle"><input type="checkbox" checked={compareIds.includes(String(s.id))} onChange={e=>setCompareIds(old=>e.target.checked?(old.length<3?[...old,String(s.id)]:old):old.filter(id=>id!==String(s.id)))}/> Compare (up to 3)</label></div>)}</div>{compareIds.length>0&&<div className="comparison-panel" aria-live="polite"><h3>Service comparison ({compareIds.length}/3)</h3><div className="comparison-grid">{compareIds.map(id=>{const s=services.find(x=>String(x.id)===id)||favorites.filter(isCurrentCard).find(x=>String(x.id)===id);return s?<article key={id}><b>{publicServiceCardName(s)}</b><p>{cardMoney(Math.ceil(s.per1000*100))} per 1,000</p><p>{Number(s.min).toLocaleString()}–{Number(s.max).toLocaleString()} units</p><button type="button" className="alt" disabled={s.purchasable===false} onClick={()=>{setSelected(s);setQty(s.min);document.getElementById("checkout")?.scrollIntoView({behavior:"smooth"})}}>{s.purchasable===false?"Unavailable for new orders":"Choose service"}</button></article>:null})}</div><button type="button" className="alt" onClick={()=>setCompareIds([])}>Clear comparison</button></div>}{!services.length&&<div className="msg" role="status" aria-live="polite">{catalogState==="error"?"We can’t load live prices right now. Please retry shortly. Prices are never guessed, and no order has been placed.":(quickKind&&["Instagram","TikTok"].includes(platform)?"Temporarily unavailable":notice||"No services match these filters.")}{catalogState==="error"&&<div><button type="button" className="alt" style={{marginTop:12}} onClick={()=>setCatalogRetry(v=>v+1)}>Retry live catalog</button></div>}</div>}<div className="pager"><button className="alt" disabled={pg===1} onClick={()=>setPg(pg-1)}>Previous</button><span className="small">Page {pg} · {total.toLocaleString()} results</span><button className="alt" disabled={pg*24>=total} onClick={()=>setPg(pg+1)}>Next</button></div></section>
 <section id="checkout" className="panel sticky"><div className="kicker">SECURE PAYKINGS CHECKOUT</div><h2>Your order</h2><ol className="checkout-steps" aria-label="Checkout steps"><li className={selected?"step-done":"step-current"}>1. Choose service</li><li className={selected&&link?"step-current":"step-pending"}>2. Order details</li><li className={cardReady?"step-done":"step-pending"}>3. Secure payment</li></ol><p className="checkout-hint">You’ll review the final USD total before paying. Card details are entered securely with PayKings.</p><form onSubmit={submit} className="form"><label>Service<input readOnly value={selected?.name||"Select a service"} /></label>{selected&&<div className="selected-service-meta"><span>{selected.min.toLocaleString()}–{selected.max.toLocaleString()} units</span><span>Litix service</span><span>{selected.refill?"Refill eligible":"Standard service"}</span><span>{money(Math.ceil(selected.per1000*100))} / 1,000</span></div>}{(()=>{const socialPlatform=socialPlatformForService(selected);const normalized=normalizeSocialProfileInput(link,socialPlatform);return <label>{socialPlatform?(socialPlatform==="instagram"?"Instagram username or profile link":"TikTok username or profile link"):
 selected?.kind==="likes"?(selected.platform==="Instagram"?"Instagram post or reel URL":"TikTok video URL"):"Public post or profile URL"}<input type={socialPlatform?"text":"url"} inputMode={socialPlatform?"text":"url"} required value={link} placeholder={socialPlatform?"@username or "+(socialPlatform==="instagram"?"instagram.com/username":"tiktok.com/@username"):selected?.kind==="likes"?(selected.platform==="Instagram"?"https://www.instagram.com/p/POST_ID/":"https://www.tiktok.com/@user/video/1234567890123456789"):"https://..."} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={socialPlatform?"profile-check-help":undefined} onChange={e=>setLink(e.target.value)}/>{socialPlatform&&<span id="profile-check-help" className="small">Enter @username or paste the direct public profile link. We convert usernames to a profile URL for fulfillment; verify it belongs to the right account before paying. {normalized.ok&&normalized.url&&<a href={normalized.url} target="_blank" rel="noopener noreferrer">Check public profile ↗</a>}</span>}</label>})()}<label>Quantity<input type="number" min={selected?.min||1} max={selected?.max||1000000} step={selected?.unitStep||1} required value={qty} onChange={e=>setQty(Number(e.target.value))}/></label><label>Email<input type="email" required placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label><div className="totalbox"><div className="small">Final price in USD</div><div className="total">{money(price)}</div><div className="small">Minimum $5 per service · verified before submitting payment</div></div>{detailsReady&&config.ready?<PremiumInlineCheckout cardReady={cardReady} busy={busy} canPay={!!selected&&!!selected.purchasable&&!busy&&config.ready} buttonLabel={busy?"Processing securely...":!config.ready?"Card checkout awaiting configuration":!cardReady?"Loading card fields...":!selected?.purchasable?"Special supplier fields required":"Pay "+money(price)+" securely"}/>:<p className="small" role="status">{!detailsReady?"Choose a service and enter a public URL, valid email, and quantity to continue to payment.":"Secure card checkout is temporarily unavailable. No payment has been taken."}</p>}{selected&&!selected.purchasable&&<p className="small">This supplier service requires special order fields not yet supported by the basic service API.</p>}<p className="small">PayKings handles raw card details, not Litix.</p>{detailsReady&&config.ready&&!cardReady&&<button type="button" className="alt" onClick={()=>{setNotice("Retrying secure card fields…");setCardRetry(v=>v+1)}}>Retry secure fields</button>}</form>{notice&&<div className="msg" role="status" aria-live="polite">{notice}</div>}{detailsReady&&config.ready&&!cardReady&&<div className="checkout-help"><b>Having trouble entering card details?</b><p className="small">Retry the secure fields first. If they still do not load, contact Litix support and mention “PayKings card fields”. Never send card numbers or security codes in chat.</p><a className="support-link" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need checkout help. The PayKings secure card fields are not loading on my mobile device.")} target="_blank" rel="noopener noreferrer">Get checkout help ↗</a></div>}{receipt&&<div className="msg"><b>{receipt.orderId}</b><p>{receipt.payment} · {receipt.fulfillment||"pending"}</p>{receipt.secret&&<><input readOnly value={privateUrl}/><button className="alt" style={{marginTop:12}} onClick={()=>navigator.clipboard.writeText(privateUrl)}>Copy tracking link</button><a className="alt" style={{display:"inline-block",margin:"10px 0 0 10px"}} href={"/track?order="+encodeURIComponent(receipt.orderId)}>Track this order</a></>}</div>}</section></div>
 <section className="panel growth-studio" id="growth-studio"><div className="kicker">LITIX GROWTH OS</div><h2>Turn your goal into a growth plan</h2><p className="muted">A practical planning workspace for creators, businesses, and agencies. Recommendations are planning guidance—not guaranteed results or live account analytics.</p><a className="alt" href="/growth" style={{display:"inline-block",marginBottom:16}}>Open Litix Content Calendar</a><div className="growth-controls"><label>Your role<select value={industry} onChange={e=>setIndustry(e.target.value)}><option>Personal brand</option><option>Creator</option><option>Influencer</option><option>Agency</option><option>Small business</option><option>Brand / enterprise</option></select></label><label>Primary goal<select value={growthGoal} onChange={e=>setGrowthGoal(e.target.value)}><option>Grow audience</option><option>Increase engagement</option><option>Launch a product</option><option>Generate leads</option><option>Build brand awareness</option><option>Improve content consistency</option></select></label><label>Planning horizon<select value={planDays} onChange={e=>setPlanDays(e.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label><button className="primary" type="button" onClick={buildPlan}>Build my plan</button></div>{planGenerated&&<div className="growth-plan" aria-live="polite"><h3>{planDays}-day plan · {growthGoal}</h3><p role="status">{planStatus}</p>{planServices.map(s=><button type="button" className="alt" key={s.id} onClick={()=>{setSelected(s);setQty(s.min);setKey(crypto.randomUUID());document.getElementById("checkout")?.scrollIntoView({behavior:"smooth"})}}>Review {s.name} · {money(Math.max(100,Math.ceil(s.per1000*s.min/1000*100)))} for {s.min} units</button>)}<ol><li><b>Set a baseline:</b> record current reach, engagement, clicks or leads relevant to your goal.</li><li><b>Build a repeatable schedule:</b> choose 3 content themes for your {industry.toLowerCase()} audience and publish consistently.</li><li><b>Test and learn:</b> compare formats, hooks, posting windows, and calls to action using available platform analytics.</li><li><b>Review weekly:</b> keep the strongest-performing ideas, improve weak ones, and document the next experiment.</li><li><b>At day {planDays}:</b> compare results against your baseline and set the next measurable target.</li></ol><button type="button" className="alt" onClick={()=>GenUIcopy("Litix "+planDays+"-day growth plan\nAudience: "+industry+"\nGoal: "+growthGoal+"\n1. Record a baseline.\n2. Plan three content themes and a consistent schedule.\n3. Test formats and calls to action.\n4. Review weekly using actual analytics.\n5. Compare results at day "+planDays+".")}>Copy plan</button></div>}</section><section className="panel campaign-studio" id="campaign-studio"><div className="kicker">CAMPAIGN WORKSPACE</div><h2>Organize your next campaign</h2><p className="muted">Create a lightweight campaign checklist saved in this browser. Team collaboration and shared cloud storage can be added in the account phase.</p><form className="campaign-form" onSubmit={e=>{e.preventDefault();if(!campaignName.trim())return;setCampaigns(old=>[{id:Date.now(),name:campaignName.trim(),goal:growthGoal,status:"Planning",createdAt:new Date().toISOString()},...old].slice(0,20));setCampaignName("")}}><input aria-label="Campaign name" placeholder="e.g. Summer product launch" value={campaignName} onChange={e=>setCampaignName(e.target.value)} maxLength={100} required/><button className="primary" type="submit">Create campaign</button></form>{campaigns.length?campaigns.map(c=><div className="workspace-row" key={c.id}><div className="workspace-link">{c.name}<small>{c.goal} · Created {new Date(c.createdAt).toLocaleDateString()}</small></div><select aria-label={"Status for "+c.name} value={c.status} onChange={e=>setCampaigns(old=>old.map(x=>x.id===c.id?{...x,status:e.target.value}:x))}><option>Planning</option><option>In progress</option><option>Review</option><option>Completed</option></select><button className="icon-action" aria-label={"Delete "+c.name} onClick={()=>setCampaigns(old=>old.filter(x=>x.id!==c.id))}>×</button></div>):<p className="small muted">Your campaigns will appear here.</p>}</section><section className="panel workspace" id="workspace"><div className="kicker">YOUR LITIX WORKSPACE</div><h2>Welcome to your workspace</h2><p className="muted small">Your saved items and tracking links are stored in this browser only. This is a convenience dashboard, not a signed-in account.</p><div className="workspace-grid"><article><h3>Saved services</h3>{favorites.filter(isCurrentCard).length?favorites.filter(isCurrentCard).map(s=><div className="workspace-row" key={s.id}><button className="workspace-link" onClick={()=>{setSelected(s);setQty(s.min);document.getElementById("checkout")?.scrollIntoView({behavior:"smooth"})}}>{s.name}<small>{s.category}</small></button><button className="icon-action" aria-label={"Remove "+s.name+" from favorites"} onClick={()=>setFavorites(old=>old.filter(x=>x.id!==s.id))}>×</button></div>):<p className="small muted">Save services you want to find again using the action below.</p>}{services.slice(0,8).map(s=><button key={s.id} className="save-service" onClick={()=>setFavorites(old=>old.some(x=>x.id===s.id)?old.filter(x=>x.id!==s.id):[{id:s.id,name:s.name,category:s.category,min:s.min,max:s.max,per1000:s.per1000,refill:s.refill,purchasable:s.purchasable},...old].slice(0,12))}>{favorites.some(x=>x.id===s.id)?"★ Saved":"☆ Save"} · {s.name}</button>)}</article><article><h3>Recent services</h3>{recentServices.filter(isCurrentCard).length?recentServices.filter(isCurrentCard).map(s=><button key={s.id} className="workspace-row workspace-link" onClick={()=>{setSelected(s);setQty(s.min);document.getElementById("checkout")?.scrollIntoView({behavior:"smooth"})}}>{s.name}<small>{s.category}</small></button>):<p className="small muted">Services you select will appear here.</p>}</article><article><h3>Order tracking links</h3>{savedOrders.length?savedOrders.map(o=><div className="workspace-row" key={o.id}><button className="workspace-link" onClick={()=>{setPrivateUrl(o.url);document.getElementById("tracking")?.scrollIntoView({behavior:"smooth"});track(o.url)}}>{o.id}<small>{o.payment} · {o.fulfillment} · {new Date(o.createdAt).toLocaleDateString()}</small></button><button className="icon-action" aria-label={"Copy tracking link for "+o.id} onClick={()=>navigator.clipboard?.writeText(o.url)}>⧉</button></div>):<p className="small muted">Your tracking links will appear here after an order is submitted in this browser.</p>}</article></div><p className="small muted">For privacy, avoid using shared devices. Clearing browser storage removes these saved items; keep a separate copy of your private tracking links.</p></section><section className="panel support-banner"><div className="support-copy"><div className="kicker">LITIX CONCIERGE</div><h2>Real support. A premium experience.</h2><p>Questions about an order? Our support channel is here to help you move forward with confidence.</p><div className="support-actions"><a className="support-link" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need help with an order.")} target="_blank" rel="noopener noreferrer">Order help ↗</a><a className="support-link" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I have a payment or checkout question.")} target="_blank" rel="noopener noreferrer">Payment help ↗</a><a className="support-link" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I have a question about a service before ordering.")} target="_blank" rel="noopener noreferrer">Service questions ↗</a></div></div><div className="support-emblem" aria-hidden="true">L<span>✦</span></div></section><section className="panel tracking" id="tracking"><div className="kicker">ORDER VISIBILITY</div><h2>Track your order</h2><p className="small">Check your order number and checkout email, or choose a saved order from this device.</p><a href="/track" className="primary" style={{display:"inline-flex",padding:"14px 20px",margin:"10px 0 18px",borderRadius:12,textDecoration:"none"}}>Open easy order tracking →</a><div className="trackingbox"><input aria-label="Tracking link" placeholder="Paste private tracking URL" value={privateUrl} onChange={e=>setPrivateUrl(e.target.value)}/><button className="primary" onClick={()=>track(privateUrl)}>Check status</button></div>{tracked&&<div className="msg" role="status" aria-live="polite"><b>{tracked.id}</b><p>{tracked.service} · {tracked.quantity} units · USD {tracked.amount}</p><p>Payment: {tracked.payment} · Fulfillment: {tracked.fulfillment} · Supplier: {tracked.status||"Pending"}</p></div>}</section><section className="panel trust-panel" id="how-it-works"><div className="kicker">THE LITIX STANDARD</div><h2>Built for a smoother experience</h2><div className="trust-grid"><article><span className="trust-symbol">01</span><h3>Choose your service</h3><p>Search the catalog, filter by category, and check the published quantity limits before selecting an option.</p></article><article><span className="trust-symbol">02</span><h3>Submit a public URL</h3><p>Use the eligible public profile or post link requested by the service. Litix never needs your social account password.</p></article><article><span className="trust-symbol">03</span><h3>Track progress</h3><p>Keep your private tracking link. It shows the latest order and supplier status when tracking data is available.</p></article></div><div className="service-note"><strong>Service availability varies.</strong> Delivery times, refill eligibility, and supported links depend on the specific supplier service. A listed service is not a guarantee of a particular outcome or platform reach.</div></section><section className="panel faq-panel" id="faq"><div className="kicker">HELP CENTER</div><h2>Frequently asked questions</h2><details><summary>What information do I need to place an order?</summary><p>Usually a supported public profile or post URL, the quantity you choose within the service limits, and an email address for order support.</p></details><details><summary>Do you need my social media password?</summary><p>No. Never share your social account password, login code, or recovery details with Litix or a supplier.</p></details><details><summary>Where can I check my order?</summary><p>Use the private tracking URL shown after your order is submitted. Save it somewhere secure; anyone with that private link may be able to view the order status.</p></details><details><summary>Why might a service or order status be unavailable?</summary><p>Supplier catalogs and status updates depend on third-party systems. If the catalog is temporarily unavailable, wait and retry later rather than repeatedly submitting the same order.</p></details><details><summary>How do I get help?</summary><p>Contact the Litix WhatsApp Concierge using the support link on this page. Share only the order ID and details needed to locate the issue—never card details, security codes, or passwords.</p></details><div className="faq-links"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/refunds">Refunds & Order Issues</a></div></section><section className="panel litix-feature-panel"><h2>Why shop with Litix</h2><div className="tags"><span>✦ Analytics Amplified</span><span>◇ Innovation Ignited</span><span>✧ Metrics that Move</span><span>◆ Data Driven Discovery</span><span>✧ Supplier-dependent delivery</span><span>◆ Refill eligibility varies</span><span>↗ Stealth Execution</span><span>✦ Live supplier catalog</span><span>◇ PayKings tokenized cards</span><span>↗ Order status tracking</span><span>◆ No social account passwords</span></div></section><footer className="end"><span>LITIX · Analytics Amplified. Innovation Ignited. · Metrics that Move · Data Driven Discovery</span><span>Litix · Secure checkout</span><span className="legal-links"><a href="/global/en" hrefLang="en">Languages</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refunds">Refunds</a></span><a href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need help with an order.")} target="_blank" rel="noopener noreferrer">WhatsApp Concierge</a></footer><a className="whatsapp-float" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need help with an order.")} target="_blank" rel="noopener noreferrer" aria-label="Chat with Litix on WhatsApp"><span className="whatsapp-icon" aria-hidden="true">☏</span><span>Chat with us</span></a></main>
}
