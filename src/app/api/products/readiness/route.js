import {NextResponse} from 'next/server';
import {packageCatalog} from '../../../../lib/specialPackages';
import {paymentGatewaySummary} from '../../../../lib/paymentGateway';
import {checkPaymentReadiness} from '../../../../lib/checkoutReadiness';
import {instagramOfferReadiness,productCheckoutReadiness} from '../../../../lib/productReadiness.mjs';
export const dynamic='force-dynamic';
export async function GET(){
 const payment=await checkPaymentReadiness(paymentGatewaySummary());
 let bundles=[],catalogAvailable=true;
 try{bundles=(await packageCatalog()).map(p=>({id:p.id,priceCents:p.priceCents,items:p.items,
  fulfillment:p.readiness,checkout:productCheckoutReadiness({fulfillment:p.readiness,paymentReady:payment.ready})}));}
 catch{catalogAvailable=false;}
 const fulfillment=instagramOfferReadiness();
 return NextResponse.json({catalogAvailable,bundles,instagramAutoBoost:{
  offer:{priceCents:700,likesPerPost:100,eligibleVideoViewsPerPost:300,termDays:30,maxPostsPerDay:3,maxTotalPosts:90},
  fulfillment,checkout:productCheckoutReadiness({fulfillment,paymentReady:payment.ready})
 }},{headers:{'Cache-Control':'no-store'}});
}
