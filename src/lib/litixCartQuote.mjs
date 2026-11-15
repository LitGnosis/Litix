import {boosteroProduction} from "./boosteroReadOnly.mjs";
import {boosteroQuote,boosteroDestination} from "./boosteroFulfillment.mjs";
import {parseCuratedId,resolveCuratedSupplier} from "./curatedCatalog.mjs";
import {resolveTikTokVideoLink} from "./tiktokVideoLinks.mjs";

import {CART_BUMP_QTY,cartBumpKind} from "./cartBumpConfig.mjs";
export const cartBumpAvailable=()=>process.env.LITIX_CART_BUMPS_ENABLED==="true";
export async function safeCartDestination(target,platform,kind){
 const p=String(platform||"").toLowerCase();
 if(!["instagram","tiktok"].includes(p))return null;
 if(p==="tiktok"&&kind!=="followers"){
  try{const canonical=await resolveTikTokVideoLink(target);
   return boosteroDestination(canonical,p,"likes");
  }catch{return null;}
 }
 return boosteroDestination(target,p,kind==="followers"?"followers":"likes");
}
export async function quoteCuratedCart({serviceId,quantity,includeBump=false,bumpTarget="",mainTarget="",operation=boosteroProduction}){
 const parsed=parseCuratedId(serviceId);
 if(!parsed||!["followers","likes","views"].includes(parsed.kind))
  throw Error("cart_not_supported");
 const qty=Number(quantity);
 if(!Number.isSafeInteger(qty)||qty<1||qty>1000000)throw Error("invalid_quantity");
 const raw=await operation("services");
 if(!Array.isArray(raw)||!raw.length)throw Error("catalog_unavailable");
 const mainService=resolveCuratedSupplier(raw,parsed.platform,parsed.kind,parsed.tier);
 if(!mainService)throw Error("main_service_unavailable");
 const main=boosteroQuote({service:mainService,quantity:qty});
 const mainDestination=mainTarget?await safeCartDestination(mainTarget,parsed.platform,parsed.kind):null;
 if(mainTarget&&!mainDestination)throw Error("invalid_main_destination");
 if(!includeBump)return {serviceId,quantity:qty,main:{service:mainService,quote:main,destination:mainDestination},totalCents:main.amountCents,bump:null};
 if(!cartBumpAvailable())throw Error("cart_bump_disabled");
 const kind=cartBumpKind(parsed.kind);
 if(!kind)throw Error("cart_bump_not_supported");
 const bumpService=resolveCuratedSupplier(raw,parsed.platform,kind,"standard");
 if(!bumpService||String(bumpService.service)===String(mainService.service))
  throw Error("bump_service_unavailable");
 const bumpQty=CART_BUMP_QTY[kind];
 const bump=boosteroQuote({service:bumpService,quantity:bumpQty});
 const target=bumpTarget||(["likes","views"].includes(parsed.kind)?mainTarget:"");
 const bumpDestination=target?await safeCartDestination(target,parsed.platform,kind):null;
 if(bumpTarget&&!bumpDestination)throw Error("invalid_bump_destination");
 const totalCents=main.amountCents+bump.amountCents;
 if(!Number.isSafeInteger(totalCents)||totalCents>100000000)throw Error("invalid_cart_amount");
 return {serviceId,quantity:qty,main:{service:mainService,quote:main,destination:mainDestination},
  bump:{service:bumpService,quote:bump,quantity:bumpQty,kind,destination:bumpDestination},
  totalCents};
}
export const publicCartQuote=(cart)=>({
 ready:true,serviceId:cart.serviceId,quantity:cart.quantity,
 mainAmountCents:cart.main.quote.amountCents,
 totalCents:cart.totalCents,
 bump:cart.bump?{kind:cart.bump.kind,quantity:cart.bump.quantity,
  amountCents:cart.bump.quote.amountCents,
  targetRequired:!cart.bump.destination}:null
});
