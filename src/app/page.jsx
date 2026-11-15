
"use client";
import {useEffect,useRef,useState} from "react";
import PremiumInlineCheckout from "../components/PremiumInlineCheckout";
import LitixIcon from "../components/LitixIcon";
import LitixProfilePreview from "../components/LitixProfilePreview";
import LitixVerifiedActivity from "../components/LitixVerifiedActivity";
import LitixCheckoutSelector from "../components/LitixCheckoutSelector";
import CuratedFastCheckout from "../components/CuratedFastCheckout";
import {choicesForPlatform,firstPackageFor} from "../lib/litixCheckoutBootstrap.mjs";
import {checkoutDisplay,defaultCheckoutQuantity,clampCheckoutQuantity,checkoutQuantityEligible,quoteCentsForQuantity,QUANTITY_PRESETS} from "../lib/litixCheckoutDisplay.mjs";
import {profilePlatformForService,normalizeProfileDestination,checkoutProfileLabel,checkoutTargetPlaceholder,validateLitixCheckoutTarget} from "../lib/litixOrderTarget.mjs";
import {restrictedSocialKind} from "../lib/publicBoosteroOnly.mjs";
import {sortServicesPer1000} from "../lib/catalogSort.mjs";
import {SERVICE_NAV_GROUPS,allowedServiceFilter} from "../lib/serviceNavigation.mjs";
import {publicServiceCardName,litixCustomerServiceName} from "../lib/serviceCardDisplay.mjs";
import {inspectTikTokVideoLink} from "../lib/tiktokVideoLinks.mjs";
import {newTikTokPost} from "../components/TikTokMultiPostChooser";
import {readCustomDraft,CUSTOM_DRAFT_PREFIX} from "../lib/customQuote.mjs";
import SocialMultiPostChooser from "../components/SocialMultiPostChooser";
import LitixQuickShop from "../components/LitixQuickShop";
import {DEFAULT_CURATED_SKU,initialCuratedOffer,curatedPresetQuantity} from "../lib/litixCuratedFirstPaint.mjs";
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",currencyDisplay:"code"}).format(n/100);
const cardMoney=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n/100); // display-only: preserve stored cents
const INITIAL_FAST_CHOICES=choicesForPlatform("Instagram");
const INITIAL_FAST_SERVICE=firstPackageFor(INITIAL_FAST_CHOICES,"followers");
const INITIAL_FAST_QUANTITY=defaultCheckoutQuantity(INITIAL_FAST_SERVICE);
const CURATED_HOME_ENABLED=process.env.NEXT_PUBLIC_LITIX_CURATED_STOREFRONT_ENABLED==="true";
// Collect.js is documented as a global named CollectJS. Some script builds expose
// that binding without a window property, so resolve both forms consistently.
const getCollectJS=()=>{try{if(typeof CollectJS!=="undefined")return CollectJS}catch{};return typeof window!=="undefined"?window.CollectJS:undefined};
const validOrderDetails=(service,url,email,quantity)=>{
 try{const u=new URL(url);return !!service?.purchasable&&["https:","http:"].includes(u.protocol)&&!u.username&&!u.password&&u.hostname.includes(".")&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&Number.isSafeInteger(quantity)&&quantity>=service.min&&quantity<=service.max&&Number.isSafeInteger(Number(service.unitStep||1))&&((quantity-Number(service.supplierMin??service.min))%Number(service.unitStep||1)===0)&&Math.ceil(service.per1000*quantity/10-1e-8)>=100}catch{return false}
};
const whatsappNumber=(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||"").replace(/\D/g,"");
const publicCollectKey=process.env.NEXT_PUBLIC_PAYKINGS_NMI_COLLECT_PUBLIC_KEY||"";
export default function Home({landingServiceId=null}){
 const firstPaintOffer=initialCuratedOffer(landingServiceId||DEFAULT_CURATED_SKU);
 const [services,setServices]=useState([]),[categories,setCategories]=useState([]),[recentServices,setRecentServices]=useState([]),[savedOrders,setSavedOrders]=useState([]),[workspaceReady,setWorkspaceReady]=useState(false),[cat,setCat]=useState(""),[query,setQuery]=useState(""),[platform,setPlatform]=useState("All platforms"),[quickKind,setQuickKind]=useState(""),[favoritesOnly,setFavoritesOnly]=useState(false),[compareIds,setCompareIds]=useState([]),[pg,setPg]=useState(1),[catalogRetry,setCatalogRetry]=useState(0),[catalogState,setCatalogState]=useState("loading"),[catalogSource,setCatalogSource]=useState("unavailable"),[catalogCheckoutEnabled,setCatalogCheckoutEnabled]=useState(false),[count,setCount]=useState(0),[total,setTotal]=useState(0),[selected,setSelected]=useState(CURATED_HOME_ENABLED?firstPaintOffer:INITIAL_FAST_SERVICE),[qty,setQty]=useState(CURATED_HOME_ENABLED?curatedPresetQuantity(firstPaintOffer):INITIAL_FAST_QUANTITY),[email,setEmail]=useState(""),[link,setLink]=useState(""),[config,setConfig]=useState({ready:false}),[cardReady,setCardReady]=useState(false),[cardRetry,setCardRetry]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[receipt,setReceipt]=useState(null),[privateUrl,setPrivateUrl]=useState(""),[tracked,setTracked]=useState(null),[key,setKey]=useState("");const done=useRef(null),submittedKey=useRef(""),checkoutLaunchRef=useRef(false);
 const [lookupId,setLookupId]=useState(""),[lookupEmail,setLookupEmail]=useState(""),[lookupBusy,setLookupBusy]=useState(false),[lookupNotice,setLookupNotice]=useState("");
 const [checkoutRoute,setCheckoutRoute]=useState(CURATED_HOME_ENABLED?"curated":"catalog");
 useEffect(()=>{
  if(!CURATED_HOME_ENABLED)return;
  const params=new URLSearchParams(location.search);
  const isCatalogDeepLink=/^(?:litix|boostero)_\d{1,12}$/.test(params.get("service")||"");
  setCheckoutRoute(isCatalogDeepLink?"catalog":"curated");
  if(!isCatalogDeepLink){
   const picked=initialCuratedOffer(landingServiceId||DEFAULT_CURATED_SKU);
   setSelected(picked);setQty(curatedPresetQuantity(picked));
  }
 },[]);
 const [verifiedQuote,setVerifiedQuote]=useState(null);
 const [checkoutPhase,setCheckoutPhase]=useState("idle");
 const [checkoutError,setCheckoutError]=useState("");
 const [verificationRetry,setVerificationRetry]=useState(0);
 const validServiceFilter=(nextPlatform,nextKind="")=>allowedServiceFilter(nextPlatform,nextKind)||(!nextKind&&["Facebook","Spotify","Other"].includes(nextPlatform));
 const applyServiceQuickFilter=(nextPlatform,nextKind="")=>{
  if(!validServiceFilter(nextPlatform,nextKind))return;
  setPlatform(nextPlatform);setQuickKind(nextKind);
  setCat("");setQuery("");setFavoritesOnly(false);setPg(1);
  const url=new URL(window.location.href);
  url.searchParams.delete("service");
  if(nextPlatform==="All platforms")url.searchParams.delete("platform");
  else url.searchParams.set("platform",nextPlatform);
  if(nextKind)url.searchParams.set("kind",nextKind);
  else url.searchParams.delete("kind");
  window.history.replaceState(window.history.state,"",url.pathname+url.search+"#services");
  requestAnimationFrame(()=>document.getElementById("service-results")?.scrollIntoView({behavior:"smooth",block:"start"}));
 };
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const initialPlatform=params.get("platform"),initialKind=params.get("kind")||"";
  if(initialPlatform&&validServiceFilter(initialPlatform,initialKind)){
   setPlatform(initialPlatform);setQuickKind(initialKind);
  }
 },[]);

 const isCurrentCard=s=>String(s?.id||"").startsWith("litix_")&&s?.purchasable===true&&services.some(a=>a.id===s.id&&a.purchasable===true);
 const tiktokLikes=String(selected?.platform||"").toLowerCase()==="tiktok"&&selected?.kind==="likes";
 const likesWithPostPicker=["instagram","tiktok"].includes(String(selected?.platform||"").toLowerCase())&&selected?.kind==="likes"&&["litix_4751","litix_5251"].includes(String(selected?.id||""));
 const [multiPostEnabled,setMultiPostEnabled]=useState(false);
 const [multiPosts,setMultiPosts]=useState([]);
 const multiMode=likesWithPostPicker&&multiPostEnabled;
 const orderQuantity=multiMode?multiPosts.reduce((sum,p)=>sum+(Number(p.quantity)||0),0):qty;
 const verifiedMultiPosts=multiMode&&multiPosts.length>=1&&multiPosts.length<=5&&multiPosts.every(p=>
   p.verifiedUrl&&p.verifiedInput===String(p.link||"").trim()&&p.status==="verified"&&
   Number.isSafeInteger(Number(p.quantity))&&Number(p.quantity)>=Number(selected?.min)&&
   Number(p.quantity)<=Number(selected?.max)&&
   (Number(p.quantity)-Number(selected?.supplierMin??selected?.min))%Number(selected?.unitStep||1)===0&&
   Math.ceil(Number(selected?.per1000||0)*Number(p.quantity)/10-1e-8)>=100
 )&&new Set(multiPosts.map(p=>p.verifiedUrl)).size===multiPosts.length;
 // An approved Custom Likes deep link opens Choose Your Posts directly.
 // No supplier request or payment is created by navigating here.
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const requested=(params.get("service")||"").replace(/^boostero_/,"litix_");
  const customLikesIntent=params.get("mode")==="multi" &&
   String(selected?.id||"")===requested &&
   ["litix_4751","litix_5251"].includes(requested) &&
   selected?.kind==="likes" &&
   ["instagram","tiktok"].includes(String(selected?.platform||"").toLowerCase());
  setMultiPostEnabled(customLikesIntent);
  let restored=null;
  if(customLikesIntent&&/^[0-9a-f-]{36}$/i.test(params.get("draft")||"")){
   try{
    const saved=JSON.parse(sessionStorage.getItem(CUSTOM_DRAFT_PREFIX+params.get("draft"))||"null");
    restored=readCustomDraft(saved,selected);
   }catch{restored=null}
  }
  // This is untrusted preview state; existing post verification and the
  // server-side supplier quote still validate every link and quantity.
  setMultiPosts(customLikesIntent?
   restored?.length?restored.map(p=>newTikTokPost({link:p.link,quantity:p.quantity,verifiedUrl:p.verifiedUrl})):
   [newTikTokPost({quantity:Number(selected?.min)||1})]:[]);
 },[selected?.id]);
 const [tiktokLinkVerification,setTikTokLinkVerification]=useState({input:"",serviceId:"",status:"idle",url:"",error:""});
 useEffect(()=>{
  if(!tiktokLikes||!link.trim()){
   setTikTokLinkVerification({input:"",serviceId:"",status:"idle",url:"",error:""});
   return;
  }
  const input=link.trim(),serviceId=selected?.id;
  const parsed=inspectTikTokVideoLink(input);
  if(!parsed){
   setTikTokLinkVerification({input,serviceId,status:"error",url:"",error:"Paste a public TikTok video URL or TikTok short share link."});
   return;
  }
  if(parsed.kind==="video"){
   setTikTokLinkVerification({input,serviceId,status:"verified",url:parsed.url,error:""});
   return;
  }
  const controller=new AbortController();
  setTikTokLinkVerification({input,serviceId,status:"checking",url:"",error:""});
  const timer=setTimeout(async()=>{
   try{
    const res=await fetch("/api/tiktok/resolve",{
     method:"POST",headers:{"content-type":"application/json"},signal:controller.signal,
     body:JSON.stringify({link:input})
    });
    const body=await res.json();
    if(!res.ok||!body.url)throw Error(body.error||"Unable to verify TikTok share link.");
    if(!controller.signal.aborted)setTikTokLinkVerification({input,serviceId,status:"verified",url:body.url,error:""});
   }catch(error){
    if(!controller.signal.aborted)setTikTokLinkVerification({input,serviceId,status:"error",url:"",error:String(error.message).slice(0,180)});
   }
  },450);
  return()=>{clearTimeout(timer);controller.abort()};
 },[tiktokLikes,link,selected?.id]);
 const verifiedTikTokVideo=tiktokLikes&&tiktokLinkVerification.status==="verified"&&
  tiktokLinkVerification.input===link.trim()&&tiktokLinkVerification.serviceId===selected?.id
  ?tiktokLinkVerification.url:"";

 const profileInput=multiMode?{ok:true}:normalizeProfileDestination(link,selected?.kind==="likes"?"":profilePlatformForService(selected));
 const targetFeedback=validateLitixCheckoutTarget(link,selected);
 const normalizedOrderLink=multiMode?(multiPosts[0]?.verifiedUrl||""):(verifiedTikTokVideo||(profileInput.url||link));
 const detailsReady=multiMode
  ?verifiedMultiPosts&&validOrderDetails(selected,normalizedOrderLink,email,Number(multiPosts[0]?.quantity||0))&&Number.isSafeInteger(orderQuantity)&&orderQuantity<=1000000
  :targetFeedback.ok&&profileInput.ok&&(!tiktokLikes||!!verifiedTikTokVideo)&&validOrderDetails(selected,normalizedOrderLink,email,qty);
 const linkReadyForCheckout=multiMode?verifiedMultiPosts:
  targetFeedback.ok&&profileInput.ok&&(!tiktokLikes||!!verifiedTikTokVideo);
 const emailReadyForCheckout=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 const quantityReadyForCheckout=multiMode
  ?verifiedMultiPosts&&Number.isSafeInteger(orderQuantity)&&orderQuantity<=1000000
  :checkoutQuantityEligible(selected,qty)&&
   (Number(qty)-Number(selected?.supplierMin??selected?.min??0))%Number(selected?.unitStep||1)===0;
 const checkoutFieldHint=selected?.preview?"":!selected?"Choose your service to continue.":
  !selected.purchasable?"Select an available package to continue.":
  !linkReadyForCheckout?(multiMode?
   "Select and verify your public posts to continue.":
   "Paste a valid public profile or post link to continue."):
  !emailReadyForCheckout?"Enter your email address for your receipt and private tracking link.":
  !quantityReadyForCheckout?
   `Enter a quantity between ${Number(selected.min).toLocaleString("en-US")} and ${Number(selected.max).toLocaleString("en-US")}.`:
  !detailsReady?"Review the selected service details to continue.":"";
 // Preserve deep links from the complete Litix directory, including services not on page one.
 useEffect(()=>{
  const id=new URLSearchParams(location.search).get("service");
  if(!/^(?:boostero|litix)_\d{1,12}$/.test(id||""))return;
  const controller=new AbortController();
  fetch("/api/catalog/v1?q="+encodeURIComponent(id),{signal:controller.signal,cache:"no-store"})
   .then(async r=>r.ok?await r.json():{items:[]})
   .then(body=>{
    if(controller.signal.aborted)return;
    const requested=id.replace(/^boostero_/,"litix_");
     const chosen=(body.items||[]).find(s=>s.id===requested&&s.purchasable===true);
    if(chosen){
     const requestedQuantity=Number(new URLSearchParams(location.search).get("quantity"));
     const quantityStep=Number(chosen.unitStep)||1;
     const quantityValid=Number.isSafeInteger(requestedQuantity)&&
      requestedQuantity>=Number(chosen.min)&&requestedQuantity<=Number(chosen.max)&&
      Number.isSafeInteger(quantityStep)&&quantityStep>0&&
      (requestedQuantity-Number(chosen.min))%quantityStep===0&&
      Math.ceil(Number(chosen.per1000)*requestedQuantity/10-1e-8)>=100;
     setSelected(chosen);
     setQty(quantityValid?requestedQuantity:defaultCheckoutQuantity(chosen));
     setNotice("");
    }
    else if(new URLSearchParams(location.search).get("mode")==="multi"){
     setNotice("This Custom Likes service is temporarily unavailable. No payment has been attempted. Try another service or contact Litix support.");
    }
   }).catch(()=>{});
  return()=>controller.abort();
 },[]);
 // Never re-select the URL's old TikTok service when a catalog refresh occurs.
 // The initial deep-link fetch above handles the desired service once.
 useEffect(()=>{
  const requested=new URLSearchParams(location.search).get("service");
  if(!requested||String(selected?.id)!==requested.replace(/^boostero_/,"litix_"))return;
  const frame=requestAnimationFrame(()=>{
   document.getElementById("checkout")?.scrollIntoView({behavior:"auto",block:"start"});
  });
  return()=>cancelAnimationFrame(frame);
 },[selected?.id]);
 useEffect(()=>{setKey(crypto.randomUUID());try{setRecentServices(JSON.parse(localStorage.getItem("litix:recent-services")||"[]"));setSavedOrders(JSON.parse(localStorage.getItem("litix:saved-orders")||"[]"));}catch{}setWorkspaceReady(true);fetch("/api/config",{cache:"no-store"}).then(r=>r.json()).then(v=>setConfig({...v,publicKey:v.publicKey||publicCollectKey,ready:!!(v.ready&& (v.publicKey||publicCollectKey))})).catch(()=>setConfig({ready:false,publicKey:publicCollectKey||""}))},[]);
 useEffect(()=>{const abort=new AbortController(),p=new URLSearchParams({category:cat,q:query,page:String(pg),platform,kind:quickKind});setCatalogState("loading");const deadline=setTimeout(()=>abort.abort("timeout"),42000);fetch("/api/catalog/v1?"+p,{signal:abort.signal}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||"Litix service catalog is temporarily unavailable");return v}).then(v=>{setServices(v.items||[]);setCategories(v.categories||[]);setCount(v.allCount||0);setTotal(v.total||0);setCatalogSource(v.catalogStatus==="live"?"live":v.catalogStatus==="cached"?"cached":"unavailable");setCatalogCheckoutEnabled(v.checkoutEnabled===true);setCatalogState("ready");if(v.error)setNotice(v.error)}).catch(e=>{if(!abort.signal.aborted||abort.signal.reason==="timeout"){setCatalogSource("unavailable");setCatalogCheckoutEnabled(false);setCatalogState("error");setNotice("The Litix service list could not be refreshed. Please retry; no order has been placed.")}}).finally(()=>clearTimeout(deadline));return()=>{clearTimeout(deadline);abort.abort()}},[cat,query,pg,platform,quickKind,catalogRetry]);
 useEffect(()=>{if(!workspaceReady)return;try{localStorage.setItem("litix:recent-services",JSON.stringify(recentServices.slice(0,8)));localStorage.setItem("litix:saved-orders",JSON.stringify(savedOrders.slice(0,12)));}catch{}},[workspaceReady,recentServices,savedOrders]);

 const price=selected?(multiMode?multiPosts.reduce((sum,p)=>
  sum+Math.max(0,quoteCentsForQuantity(selected,Number(p.quantity))||0),0)
  :(quoteCentsForQuantity(selected,qty)??0)):0;
 const checkoutAuthorized=multiMode?catalogCheckoutEnabled:
   !!verifiedQuote&&verifiedQuote.serviceId===selected?.id&&
   verifiedQuote.quantity===orderQuantity&&verifiedQuote.amountCents===price;
 // Independent read-only checkout preflight; neither saved listing nor a
 // successful tokenization alone authorizes the server to charge a card.
 useEffect(()=>{
  setVerifiedQuote(null);
  if(!selected?.id||!selected.purchasable){
   setCheckoutPhase("idle");setCheckoutError("");return;
  }
  if(multiMode){
   setCheckoutPhase(catalogCheckoutEnabled?"ready":"error");
   setCheckoutError(catalogCheckoutEnabled?"":"Multi-post checkout needs a fresh eligibility check. No payment attempted.");
   return;
  }
  if(!config.ready||!config.publicKey){
   setCheckoutPhase("error");
   setCheckoutError("Secure PayKings fields are not configured or available. Retry or contact support; no charge was attempted.");
   return;
  }
  if(!Number.isSafeInteger(orderQuantity)||orderQuantity<1||
     !Number.isSafeInteger(price)||price<100){
   setCheckoutPhase("idle");setCheckoutError("");return;
  }
  let active=true;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort("quote_deadline"),4000);
  setCheckoutPhase("validating");setCheckoutError("");
  const params=new URLSearchParams({
   serviceId:selected.id,quantity:String(orderQuantity),
   expectedAmountCents:String(price)
  });
  fetch("/api/checkout/readiness?"+params,{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const body=await response.json().catch(()=>({}));
    if(!response.ok||body.ready!==true)throw Error(body.error||"Current checkout availability could not be verified.");
    if(body.serviceId!==selected.id||body.amountCents!==price||
       body.quantity!==orderQuantity)throw Error("Package quote changed. Check the total and retry.");
    return body;
   })
   .then(body=>{
    if(!active)return;
    setVerifiedQuote({serviceId:body.serviceId,amountCents:body.amountCents,quantity:body.quantity});
    setCheckoutPhase("ready");
   })
   .catch(error=>{
    if(!active)return;
    console.warn("Litix checkout readiness preflight:",String(error?.name||"error"));
    setVerifiedQuote(null);setCheckoutPhase("error");
    setCheckoutError(controller.signal.aborted?
     "Price verification took too long. Your selection is saved; retry or contact support. No charge attempted.":
     String(error.message||"Current service could not be verified.").slice(0,240));
   })
   .finally(()=>clearTimeout(timeout));
  return()=>{active=false;clearTimeout(timeout);controller.abort()};
 },[selected?.id,selected?.purchasable,orderQuantity,price,multiMode,
    catalogCheckoutEnabled,config.ready,config.publicKey,verificationRetry]);

 useEffect(()=>{
  if(!checkoutAuthorized||!config.publicKey||!config.ready||!selected?.purchasable){setCardReady(false);return;}

  let active=true;
  let configured=false;
  let failed=false;
  let timeoutId=null;

  setCardReady(false);
  setNotice("");

  // Cache-bust Collect.js on each fresh initialization so mobile Safari does not reuse a stale/partial gateway script.
  const scriptUrl="https://secure.nmi.com/token/Collect.js";
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
   setCheckoutPhase("error");
   setCheckoutError(message);
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
       setCheckoutPhase("error");
       checkoutLaunchRef.current=false;
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
 },[config.ready,config.publicKey,cardRetry,selected?.id,checkoutAuthorized]);
 async function purchase(token){
  if(!checkoutAuthorized){setCheckoutPhase("error");setNotice("Verify the current package price before submitting payment. No charge attempted.");return;}
  if(!key||submittedKey.current===key)return;
  submittedKey.current=key;
  setCheckoutPhase("processing");
  try{
   const r=await fetch("/api/checkout/v1",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({serviceId:selected.id,quantity:orderQuantity,email,link:normalizedOrderLink,...(multiMode?{postAllocations:multiPosts.map(p=>({link:p.verifiedUrl,quantity:Number(p.quantity)}))}:{}),paymentToken:token,idempotencyKey:key,expectedAmountCents:price}),signal:AbortSignal.timeout(60000)});
   const v=await r.json();
   // Ambiguous checkout outcomes reuse the original idempotency key to avoid accidental duplicate charges.
   if(!r.ok&&r.status!==202)throw Error(v.error||"Payment processing failed");
   setReceipt(v);setNotice(v.message);
   setCheckoutPhase("ready");
   if(v.orderId&&v.secret){
    const trackingUrl=location.origin+"/track?track="+encodeURIComponent(v.orderId)+"&token="+encodeURIComponent(v.secret);
    const item={id:v.orderId,url:trackingUrl,createdAt:new Date().toISOString(),payment:v.payment,fulfillment:v.fulfillment||"pending",quantity:orderQuantity,destination:normalizedOrderLink};
    setPrivateUrl(trackingUrl);
    setSavedOrders(old=>[item,...old.filter(o=>o.id!==v.orderId)].slice(0,12));
    try{const saved=JSON.parse(localStorage.getItem("litix:saved-orders")||"[]");localStorage.setItem("litix:saved-orders",JSON.stringify([item,...saved.filter(o=>o.id!==v.orderId)].slice(0,12)))}catch{}
    if(v.payment==="paid"){
     let stored=false;
     try{
      sessionStorage.setItem("litix:last-confirmation",JSON.stringify({orderId:v.orderId,trackingUrl,payment:v.payment,fulfillment:v.fulfillment||"pending",amountCents:price,service:selected?checkoutDisplay(selected).title:"Social media service",quantity:orderQuantity,destination:normalizedOrderLink,createdAt:item.createdAt}));
      stored=true;
     }catch{}
     if(stored){location.assign("/confirmation?order="+encodeURIComponent(v.orderId));return}
    }
   }
  }catch(e){setNotice(e.message);setCheckoutPhase("error");setCheckoutError(String(e.message||"Checkout error").slice(0,240))}
  finally{checkoutLaunchRef.current=false;setBusy(false)}
 }
 done.current=purchase;
 async function verifyQuoteBeforePayment(){
  const allocations=multiMode?multiPosts.map(post=>Number(post.quantity)):[Number(orderQuantity)];
  const checked=await Promise.all(allocations.map(async quantity=>{
   const amountCents=quoteCentsForQuantity(selected,quantity);
   const params=new URLSearchParams({serviceId:selected.id,quantity:String(quantity),expectedAmountCents:String(amountCents)});
   const response=await fetch("/api/checkout/readiness?"+params.toString(),{
    cache:"no-store",signal:AbortSignal.timeout(10000)
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok||result.ready!==true)throw Error(result.error||"Live package verification was unsuccessful. Please retry.");
   if(result.serviceId!==selected.id||result.quantity!==quantity||result.amountCents!==amountCents)
    throw Error("This package's price or quantity changed. Review your selection and retry.");
   return result.amountCents;
  }));
  if(checked.reduce((sum,amount)=>sum+amount,0)!==price)
   throw Error("The current package price changed. Review the total and retry.");
 }
 const submit=async e=>{
  e.preventDefault();
  if(busy||checkoutLaunchRef.current)return;
  if(!checkoutAuthorized||!detailsReady||!cardReady||!selected||!config.ready||!config.publicKey){
   setCheckoutPhase("error");
   setNotice("Enter a valid public link, quantity and email, then check secure card readiness.");
   return;
  }
  if(!Number.isSafeInteger(orderQuantity)||orderQuantity<selected.min||
     (multiMode?orderQuantity>1000000:orderQuantity>selected.max)){
   setNotice("Enter a whole-number quantity within this service’s limits.");
   return;
  }
  if(!selected.purchasable){setNotice("Choose a purchasable package before checkout.");return;}
  checkoutLaunchRef.current=true;
  setBusy(true);setCheckoutPhase("validating");setNotice("");setCheckoutError("");
  try{
   await verifyQuoteBeforePayment();
   if(typeof getCollectJS()?.startPaymentRequest!=="function")
    throw Error("Secure PayKings fields are not ready. Retry secure fields.");
   setCheckoutPhase("processing");
   getCollectJS().startPaymentRequest();
  }catch(error){
   checkoutLaunchRef.current=false;
   setBusy(false);setCheckoutPhase("error");
   const message=String(error?.message||"Live checkout verification could not be completed. Please retry.").slice(0,240);
   setCheckoutError(message);setNotice(message);
  }
 };
 const track=async value=>{try{const u=new URL(value,location.origin),id=u.searchParams.get("track"),token=u.searchParams.get("token");if(!id||!token)throw Error("Paste the full private tracking URL");const r=await fetch("/api/track?id="+encodeURIComponent(id)+"&token="+encodeURIComponent(token)),v=await r.json();if(!r.ok)throw Error(v.error||"Tracking failed");setTracked(v.order)}catch(e){setLookupNotice(e.message)}};
 async function trackByNumber(e){
  e.preventDefault();if(lookupBusy)return;
  const id=lookupId.trim(),mail=lookupEmail.trim().toLowerCase();
  if(!/^ltx2_[a-f0-9-]{36}$/.test(id)||!/^\S+@\S+\.\S+$/.test(mail)){
   setLookupNotice("Enter your complete Litix order number and the checkout email.");return;
  }
  setLookupBusy(true);setLookupNotice("");setTracked(null);
  try{
   const r=await fetch("/api/order-lookup",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({orderId:id,email:mail}),cache:"no-store",signal:AbortSignal.timeout(15000)});
   const data=await r.json();
   if(!r.ok||!data.order)throw Error(data.error||"Order verification unavailable.");
   setTracked(data.order);setLookupNotice(data.order.statusNote||"Order found. See the latest recorded status below.");
  }catch(e){setLookupNotice(e.message||"Order status is temporarily unavailable. Try /track.");}
  finally{setLookupBusy(false)}
 }
 useEffect(()=>{if(location.search.includes("track=")){setPrivateUrl(location.href);track(location.href)}},[]);
 return <main className="wrap"><nav className="nav litix-home-nav"><a className="brand" href="/" aria-label="Litix home"><img src="/assets/brand/litix-logo.webp" alt="Litix — Innovation, Ignited." className="litix-new-logo" /></a><div><a href="/services">Services</a><a href="#tracking">Track order</a><a href="/workspace">Workspace</a></div></nav>
 
 {!landingServiceId&&<LitixQuickShop/>}

   <div className="litix-purchase-layout"><section id="checkout" className="panel sticky"><div className="kicker">SECURE PAYKINGS CHECKOUT</div><h2>Your order</h2><ol className="checkout-steps" aria-label="Checkout steps"><li className={selected?"step-done":"step-current"}>Choose service</li><li className={selected&&link?"step-current":"step-pending"}>Order details</li><li className={cardReady?"step-done":"step-pending"}>Secure payment</li></ol><form onSubmit={submit} className="form">
 {checkoutRoute==="curated"?
 <CuratedFastCheckout selected={selected} quantity={qty} initialServiceId={landingServiceId||DEFAULT_CURATED_SKU}
  onChoose={service=>{
   const sameService=Boolean(service&&selected?.id===service.id);
   const preferredQuantity=sameService&&checkoutQuantityEligible(service,qty)
    ?qty:service?.preview?curatedPresetQuantity(service):defaultCheckoutQuantity(service);
   setSelected(service);setQty(preferredQuantity);setReceipt(null);
   setNotice("");setKey(crypto.randomUUID());
  }}
  onQuantityChange={setQty}/>:
 <LitixCheckoutSelector selected={selected} onChoose={service=>{setSelected(service);setQty(defaultCheckoutQuantity(service));setReceipt(null);setNotice("");setKey(crypto.randomUUID())}}/>}
 {!multiMode&&<label className="litix-early-link" style={{display:"block",margin:"14px 0"}}>
  {selected?(profilePlatformForService(selected)?
   checkoutProfileLabel(profilePlatformForService(selected)):
   selected.platform==="Instagram"?"Public Instagram post or reel link":
   selected.platform==="TikTok"?"Public TikTok video link":
   "Public "+selected.platform+" post or page link"):"Public profile or post link"}
  <input key={String(selected?.platform||"")+"-"+String(selected?.kind||"")} aria-label="Public profile or post link" type="text"
   value={link} onChange={e=>setLink(e.target.value)}
   onBlur={()=>{const platform=profilePlatformForService(selected);if(platform&&profileInput.ok&&profileInput.url&&link!==profileInput.url)setLink(profileInput.url);}}
   placeholder={checkoutTargetPlaceholder(selected)} autoComplete="off"
   autoCapitalize="none" autoCorrect="off" spellCheck={false}
   aria-invalid={Boolean(link.trim()&&selected&&!targetFeedback.ok)}
   aria-describedby="litix-link-feedback"/>
  <span className="small" id="litix-link-feedback" role="status" aria-live="polite">
   {link.trim()?targetFeedback.message:""}
   {tiktokLikes&&tiktokLinkVerification.input===link.trim()&&
    tiktokLinkVerification.serviceId===selected?.id&&
    (tiktokLinkVerification.status==="checking"?" Verifying TikTok share link…":
     tiktokLinkVerification.status==="error"?" "+tiktokLinkVerification.error:
     tiktokLinkVerification.status==="verified"?" TikTok video verified.":"")}
   {selected&&profileInput.ok&&profileInput.url&&
    <a href={profileInput.url} target="_blank" rel="noopener noreferrer"> Check public profile</a>}
  </span>
 </label>}
 {!multiMode&&profilePlatformForService(selected)&&link.trim()&&
  <LitixProfilePreview platform={profilePlatformForService(selected)} value={link}/>}
 {selected?<>{likesWithPostPicker&&<div role="group" aria-label="Choose Likes checkout mode" style={{display:"flex",gap:10,flexWrap:"wrap",padding:"8px 0 16px"}}>
  <button type="button" className="alt" aria-pressed={!multiMode} onClick={()=>{
   if(multiPosts.length){setLink(multiPosts[0].link);setQty(Number(multiPosts[0].quantity)||selected.min);}
   setMultiPostEnabled(false);
  }}>{tiktokLikes?"One video":"One post"}</button>
  <button type="button" className="alt" aria-pressed={multiMode} onClick={()=>{
   if(!multiMode){
    setMultiPosts([newTikTokPost({link,quantity:qty,verifiedUrl:tiktokLikes?verifiedTikTokVideo:""})]);
    setMultiPostEnabled(true);
   }
  }}>Choose multiple posts</button>
 </div>}
 {multiMode?<SocialMultiPostChooser service={selected} platform={String(selected?.platform||"").toLowerCase()} posts={multiPosts} onChange={setMultiPosts}/>:<>{checkoutRoute!=="curated"&&<div className="litix-quantity-control" aria-label="Set order quantity">
 <div className="litix-quantity-heading"><strong>Quantity</strong><span>Choose a preset or enter a custom amount</span></div>
 <div className="litix-quantity-presets" role="group" aria-label="Quick quantity presets">
 {QUANTITY_PRESETS.map(preset=><button type="button" key={preset}
  className={"alt litix-quantity-preset"+(qty===preset?" selected":"")}
  aria-pressed={qty===preset}
  disabled={!checkoutQuantityEligible(selected,preset)}
  title={!checkoutQuantityEligible(selected,preset)?"Not available for this package":"Select "+preset.toLocaleString()+" units"}
  onClick={()=>setQty(preset)}>{preset.toLocaleString("en-US")}</button>)}
 </div>
 <label htmlFor="litix-quantity-custom">Custom quantity
 <input id="litix-quantity-custom" aria-label="Custom quantity" type="number"
  min={selected?.min||1} max={selected?.max||1000000} step={selected?.unitStep||1}
  required value={qty} onChange={e=>setQty(Number(e.target.value))}
  onBlur={()=>setQty(clampCheckoutQuantity(qty,selected))}/></label>

 </div>}{selected&&qty<selected.min&&<div className="checkout-quantity-warning" role="alert"><strong>Minimum quantity for this service: {selected.min.toLocaleString()}.</strong><p>You entered {qty.toLocaleString()}. The $1 minimum order does not override the service's quantity requirement. The lowest eligible total for this service is {money(Math.ceil(selected.per1000*selected.min/10-1e-8))}.</p><button type="button" className="alt" onClick={()=>setQty(selected.min)}>Use minimum: {selected.min.toLocaleString()} units</button></div>}</>}
 <label>Email<input type="email" required placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <div className="totalbox" aria-live="polite">
  <div className="small">Total (USD)</div>
  <div className="total">{cardMoney(price)}</div>
 </div>
 {checkoutError&&checkoutPhase==="error"&&<p className="small" role="alert">{checkoutError}</p>}
 {selected&&!selected.purchasable&&!selected.preview&&
  <p className="small">This package is not currently available for purchase. Select another service or contact Litix support.</p>}
 {selected?.purchasable&&checkoutAuthorized&&config.ready&&!cardReady&&<button type="button" className="alt" onClick={()=>{setNotice("Retrying secure card fields…");setCardRetry(v=>v+1)}}>Retry secure fields</button>}
 </>:null}
 {checkoutRoute==="curated"&&selected&&<p className="litix-curated-fulfillment">
  Eligible orders are submitted after confirmed payment. Start times vary by service.
 </p>}
 <LitixVerifiedActivity/>
 <PremiumInlineCheckout
  showSticky={Boolean(selected)}
  selectedLabel={selected?checkoutDisplay(selected).title:""}
  totalLabel={cardMoney(price)}
  showFields={Boolean(selected?.purchasable&&checkoutAuthorized&&config.ready&&config.publicKey)}
  cardReady={cardReady}
  busy={busy}
  canPay={Boolean(selected?.purchasable&&checkoutAuthorized&&detailsReady&&cardReady&&!busy&&config.ready&&config.publicKey)}
  buttonLabel={busy?(checkoutPhase==="validating"?"Verifying live price…":"Processing securely…"):
   detailsReady&&selected?.purchasable?"Pay with PayKings — "+cardMoney(price)+" USD":
   selected?"Continue to Secure Checkout — "+cardMoney(price):"Choose your service"}
  helperText={checkoutFieldHint}
 />
 {selected?.purchasable&&detailsReady&&!checkoutAuthorized&&checkoutPhase!=="validating"&&config.ready&&<button type="button" className="alt" onClick={()=>setVerificationRetry(value=>value+1)}>Retry price verification</button>}
 </form>{notice&&<div className="msg" role="status" aria-live="polite">{notice}</div>}{selected?.purchasable&&checkoutAuthorized&&config.ready&&!cardReady&&<div className="checkout-help"><b>Having trouble entering card details?</b><p className="small">Retry secure card fields. If PayKings remains unavailable, contact Litix support; do not send card numbers or security codes in chat.</p><a className="support-link" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need checkout help. The PayKings secure card fields are not loading on my mobile device.")} target="_blank" rel="noopener noreferrer">Get checkout help ↗</a></div>}{receipt&&<div className="msg"><b>{receipt.orderId}</b><p>{receipt.payment} · {receipt.fulfillment||"pending"}</p>{receipt.secret&&<><input readOnly value={privateUrl}/><button className="alt" style={{marginTop:12}} onClick={()=>navigator.clipboard.writeText(privateUrl)}>Copy tracking link</button><a className="alt" style={{display:"inline-block",margin:"10px 0 0 10px"}} href={"/track?order="+encodeURIComponent(receipt.orderId)}>Track this order</a></>}</div>}</section></div>

 <section className="panel trust-panel" id="how-it-works"><div className="kicker">THE LITIX STANDARD</div><h2>Built for a smoother experience</h2><div className="trust-grid"><article><span className="trust-symbol">01</span><h3>Choose your service</h3><p>Search the catalog, filter by category, and check the published quantity limits before selecting an option.</p></article><article><span className="trust-symbol">02</span><h3>Submit a public URL</h3><p>Use the eligible public profile or post link requested by the service. Litix never needs your social account password.</p></article><article><span className="trust-symbol">03</span><h3>Track progress</h3><p>Keep your private tracking link. It shows your latest recorded payment and delivery updates when available.</p></article></div><div className="service-note"><strong>Verified Real-Time Catalog.</strong> Check package details and review your final price before payment. Delivery progress and refill eligibility are shown in your order updates.</div>
 <div className="tags" aria-label="Litix capabilities">
 <span><LitixIcon name="lock" size={17}/> Hosted PayKings fields</span>
 <span><LitixIcon name="receipt" size={17}/> Private order tracking</span>
 <span><LitixIcon name="badge-check" size={17}/> Verified service selection</span>
 <span><LitixIcon name="layers" size={17}/> Order status updates</span>
 </div></section><section className="panel tracking" id="tracking">
 <div className="kicker">PRIVATE ORDER LOOKUP</div><h2>Track your order</h2>
 <p className="small">Enter your Litix order number and checkout email to see the latest recorded payment and delivery status.</p>
 <form className="trackingbox" onSubmit={trackByNumber}>
  <label>Order number<input aria-label="Litix order number" autoCapitalize="none" spellCheck={false}
   placeholder="ltx2_..." value={lookupId} onChange={e=>setLookupId(e.target.value)} required/></label>
  <label>Checkout email<input aria-label="Checkout email" type="email" autoComplete="email"
   placeholder="you@example.com" value={lookupEmail} onChange={e=>setLookupEmail(e.target.value)} required/></label>
  <button className="primary" type="submit" disabled={lookupBusy}>{lookupBusy?"Checking…":"Check status"}</button>
 </form>
 <details style={{marginTop:14}}><summary>Have a private tracking link instead?</summary>
  <div className="trackingbox"><input aria-label="Private tracking link" placeholder="Paste full private tracking URL" value={privateUrl} onChange={e=>setPrivateUrl(e.target.value)}/>
   <button type="button" className="alt" onClick={()=>track(privateUrl)}>Use tracking link</button></div>
 </details>
 {lookupNotice&&<p role="status" aria-live="polite">{lookupNotice}</p>}
 {tracked&&<div className="msg" role="status" aria-live="polite"><b>{tracked.id}</b>
  <p>{litixCustomerServiceName(tracked.service)} · {tracked.quantity} units · USD {tracked.amount}</p>
  <p>Payment: {tracked.payment} · Fulfillment: {tracked.fulfillment} · Status: {tracked.status||"Pending"}</p>
 </div>}
 <div className="litix-track-support">
  <a href="/track">Full order tracking center</a>
  <a href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hello Litix Concierge, I need help with my order.")} target="_blank" rel="noopener noreferrer">WhatsApp Concierge</a>
  <a href="mailto:Litixsocial@gmail.com?subject=Litix%20Order%20Support">Email Support</a>
 </div>
 </section><section className="panel faq-panel" id="faq"><div className="kicker">HELP CENTER</div><h2>Frequently asked questions</h2><details><summary>What information do I need to place an order?</summary><p>Usually a supported public profile or post URL, the quantity you choose within the service limits, and an email address for order support.</p></details><details><summary>Where can I check my order?</summary><p>Use the Order Number + Checkout Email lookup form above, or open your private tracking link from your order confirmation. Bookmark your private tracking link for one-click status updates—treat it like a private receipt and only share it with people you want viewing your order progress.</p></details><details><summary>When will my order be processed?</summary><p>Payment authorization and service eligibility are verified immediately at checkout. Eligible orders can begin processing within minutes after payment confirmation; exact start times vary based on service type and live network demand. You can monitor the latest recorded progress anytime in the order tracker.</p></details><details><summary>How do I get help?</summary><p>Use the Litix Concierge links in the order tracking bar for questions about purchases and status.</p></details></section><footer className="end"><span>LITIX · Innovation, Ignited. Direct Social Media Growth & Campaign Workflows · Encrypted PayKings Checkout</span><nav className="legal-links" aria-label="Litix footer links"><a href="/solutions">Growth Solutions</a><a href="/partners">Partner Program</a><a href="/global/en" hrefLang="en">Languages</a><a href="/legal/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/refunds">Refunds &amp; Order Issues</a></nav><a href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need help with an order.")} target="_blank" rel="noopener noreferrer">WhatsApp Concierge</a></footer><a className="whatsapp-float" href={"https://wa.me/"+(whatsappNumber.length>=8?whatsappNumber:"19452106315")+"?text="+encodeURIComponent("Hi Litix, I need help with an order.")} target="_blank" rel="noopener noreferrer" aria-label="Chat with Litix on WhatsApp"><span className="whatsapp-icon" aria-hidden="true"><LitixIcon name="phone" size={20}/></span><span>Chat with us</span></a></main>
}
