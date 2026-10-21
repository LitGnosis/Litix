// SMMGLOB public listing: service 33532, API $6.009/1K, 365-day refill.
export const followerOffers = [
 {id:'ig_followers_launch',platform:'Instagram',tier:'Launch',name:'Instagram Launch Followers',priceCents:4485,quantity:4900,serviceKey:'smmglob:33532',hasRefill:true,refillDuration:365},
 {id:'ig_followers_momentum',platform:'Instagram',tier:'Momentum',name:'Instagram Momentum Followers',priceCents:8985,quantity:9900,serviceKey:'smmglob:33532',hasRefill:true,refillDuration:365}
];
export function validateFollowerOffer(offer,service){
 if(!offer||!service||service.provider!=='smmglob'||String(service.providerServiceId)!=='33532'||service.platform!=='Instagram'||service.kind!=='Followers'||service.refillTermDays!==365)return false;
 const cost=Number(service.providerRateUsd)*offer.quantity/1000;
 return Number.isFinite(cost)&&cost>0&&cost*1.5<=offer.priceCents/100&&offer.quantity>=Number(service.min)&&offer.quantity<=Number(service.max);
}
