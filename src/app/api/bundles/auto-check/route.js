// Read-only eligibility check for fixed-price packages.
// No card request, no DB write, no supplier add and no private wholesale disclosure.
// A two-minute in-memory cache caps repeated calls to the external provider.
import {growthBundle} from "../../../../lib/growthBundles.mjs";
import {quoteFixedBundle,isBundleAutoEnabled} from "../../../../lib/growthBundleRouting.mjs";
import {boosteroProduction} from "../../../../lib/boosteroReadOnly.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const memo=new Map();
export async function GET(req){
 const p=new URL(req.url).searchParams,packageId=String(p.get("package")||"");
 const pkg=growthBundle(packageId),postCount=Number(p.get("posts")||1);
 if(!pkg||![1,3,5,10].includes(postCount))
  return Response.json({error:"Invalid package or post count"},{status:422});
 const key=pkg.id+":"+postCount,record=memo.get(key);
 if(record&&Date.now()-record.time<120000)
  return Response.json(record.result,{"headers":{"cache-control":"no-store"}});
 const account=pkg.platform==="Instagram"?"@litixpreview":"@litixpreview";
 const posts=Array.from({length:postCount},(_,index)=>pkg.platform==="Instagram"
  ?"https://www.instagram.com/p/LitixPreflight"+index+"QA/"
  :"https://www.tiktok.com/@litixpreview/video/"+String(7700000000000000000n+BigInt(index)));
 let ready=false,reason="Live supplier eligibility cannot currently be verified";
 try{
  const [services,balance]=await Promise.all([boosteroProduction("services"),boosteroProduction("balance")]);
  if(String(balance?.currency||"").toUpperCase()!=="USD")throw Error("currency_unverified");
  quoteFixedBundle(pkg,account,posts,services,{balanceUSD:Number(balance.balance)});
  ready=true;reason="";
 }catch(e){reason=String(e?.message||"supplier_unavailable").slice(0,65);}
 const result={brand:"Litix",packageId:pkg.id,postCount,autoEligible:ready,
  autoCheckoutEnabled:ready&&isBundleAutoEnabled(),reason:ready?undefined:"Automatic delivery is temporarily unavailable for this package. Manual checkout remains available."};
 memo.set(key,{time:Date.now(),result});
 if(memo.size>32)memo.delete(memo.keys().next().value);
 return Response.json(result,{headers:{"cache-control":"no-store"}});
}
