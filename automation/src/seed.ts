import {db} from "./db.js";
import {Platform,ServiceKind} from "@prisma/client";

const tiers=[
 {slug:"launch",price:5382,units:[25000,100000,1000,5000]},
 {slug:"momentum",price:10782,units:[50000,250000,2500,10000]},
 {slug:"power",price:19782,units:[100000,500000,5000,20000]},
 {slug:"apex",price:35982,units:[250000,1000000,10000,50000]}
] as const;
const kinds:ServiceKind[]=["LIKES","VIEWS","SHARES","FOLLOWERS"];
const weights=[6,3,3,9];
function allocate(price:number,quantities:readonly number[]) {
 const raw=quantities.map((q,i)=>q*weights[i]);
 const total=raw.reduce((a,b)=>a+b,0);
 const floors=raw.map(w=>Math.floor(price*w/total));
 let remainder=price-floors.reduce((a,b)=>a+b,0);
 for(let i=0;remainder>0;i=(i+1)%floors.length,remainder--)floors[i]++;
 return floors;
}
async function main(){
 for(const platform of ["INSTAGRAM","TIKTOK"] as Platform[]){
  for(const tier of tiers){
   const id=(platform==="INSTAGRAM"?"ig_":"tt_")+tier.slug;
   const shares=allocate(tier.price,tier.units);
   await db.bundlePlan.upsert({
    where:{id},update:{},create:{
     id,platform,priceCents:tier.price,enabled:false,
     parts:{create:kinds.map((kind,i)=>({
      ordinal:i+1,kind,quantity:tier.units[i],retailShareCents:shares[i]
     }))}
    }
   });
  }
 }
 await db.supplier.upsert({
  where:{id:"boostero"},update:{},create:{
   id:"boostero",endpointUrl:"https://boostero.com/api/v2",
   credentialEnvKey:"BOOSTERO_API_KEY",approved:false,state:"INACTIVE"
  }
 });
 console.log("Seeded eight inactive fixed-price bundle plans and unapproved Boostero.");
}
void main().finally(()=>db.$disconnect());
