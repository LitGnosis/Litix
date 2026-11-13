// Public-display resilience only. Historical product listings are NOT proof a
// supplier can fulfill an order. The card checkout must always re-quote live.
import {neon} from "@neondatabase/serverless";

const fromEnv=()=>process.env.LITIX_V2_DATABASE_URL||
 process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRES_PRISMA_URL;
const safeId=/^boostero_[0-9]{1,12}$/;
const MAX_ROWS=5000;
const MAX_AGE_HOURS=24;
let lastPersistAt=0;

function sanitizeCard(row){
 if(!row||!safeId.test(String(row.id||""))||row.purchasable!==true||
    !Number.isFinite(Number(row.per1000))||Number(row.per1000)<=0||
    !Number.isSafeInteger(Number(row.startingAmountCents))||
    Number(row.startingAmountCents)<100)return null;
 const allowed=["id","name","category","platform","kind","type","min","max",
  "unitStep","per1000","startingAmountCents","purchasable","pricingReview","refill"];
 return Object.fromEntries(allowed.map(k=>[k,row[k]]).filter(([,v])=>v!==undefined));
}

export async function persistVerifiedCatalog(cards,{sqlFactory=neon,clock=()=>Date.now()}={}){
 const url=fromEnv();
 if(!url||!Array.isArray(cards)||cards.length===0)return false;
 if(clock()-lastPersistAt<5*60*1000)return false;
 const unique=new Map();
 for(const item of cards){
  const card=sanitizeCard(item);
  if(card)unique.set(card.id,card);
 }
 if(!unique.size||unique.size>MAX_ROWS)return false;
 const json=JSON.stringify([...unique.values()]);
 if(json.length>4_000_000)return false;
 const sql=sqlFactory(url);
 // Server-verified Boostero cards only; no direct supplier URLs or secrets.
 await sql.query(`INSERT INTO public.litix_public_catalog_snapshot(service_id,card,observed_at)
    SELECT value->>'id', value,now() FROM jsonb_array_elements($1::jsonb)
    ON CONFLICT(service_id) DO UPDATE SET
      card=EXCLUDED.card,observed_at=EXCLUDED.observed_at`,[json]);
 lastPersistAt=clock();
 return true;
}

export async function readDurableCatalog({sqlFactory=neon}={}){
 const url=fromEnv();
 if(!url)return {items:[],status:"unavailable"};
 const sql=sqlFactory(url);
 try{
  const rows=await sql.query(`SELECT card FROM public.litix_public_catalog_snapshot
    WHERE observed_at>now()-interval '24 hours'
    ORDER BY service_id LIMIT $1`,[MAX_ROWS]);
  const items=rows.map(r=>sanitizeCard(r.card)).filter(Boolean);
  return {items,status:items.length?"cached":"unavailable",
   maxAgeHours:MAX_AGE_HOURS};
 }catch{return {items:[],status:"unavailable"}}
}
