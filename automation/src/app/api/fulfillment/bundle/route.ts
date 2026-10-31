import {createHmac,createHash,timingSafeEqual} from "node:crypto";
import {Prisma, type Platform, type ServiceKind} from "@prisma/client";
import {db} from "../../../../db.js";
import {dispatch} from "../../../../engine.js";
import {parseProfile,parsePost,targetsFor} from "../../../../targets.js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

type LegacyPaid={
  id:string;package_id:string;platform:string;price_cents:number;
  gateway_transaction_id:string;profile_ref:string;customer_id:string|null;
  email:string;package_items:unknown;auto_fulfillment_enabled:boolean;
};
function verifyInternal(raw:string,req:Request){
  const secret=process.env.LITIX_WARRIOR_WEBHOOK_SECRET||"";
  const stamp=Number(req.headers.get("x-litix-timestamp"));
  const supplied=(req.headers.get("x-litix-signature")||"").replace(/^sha256=/,"");
  if(secret.length<32||!Number.isSafeInteger(stamp)||Math.abs(Date.now()-stamp)>300000||
    !/^[a-f0-9]{64}$/i.test(supplied))return false;
  const expected=createHmac("sha256",secret).update(String(stamp)+"."+raw).digest("hex");
  return timingSafeEqual(Buffer.from(supplied,"hex"),Buffer.from(expected,"hex"));
}
export async function POST(request:Request){
  if(process.env.LITIX_WARRIOR_ENABLED!=="true")
    return Response.json({error:"disabled"},{status:503});
  let raw:string;
  try{raw=await request.text();if(raw.length>8000)throw Error("too_big");}
  catch{return Response.json({error:"invalid_body"},{status:400});}
  if(!verifyInternal(raw,request))return Response.json({error:"unauthorized"},{status:401});
  let input:{orderId?:string;postUrls?:string[]};
  try{input=JSON.parse(raw);}
  catch{return Response.json({error:"invalid_json"},{status:400});}
  if(!/^lbg_[0-9a-f-]{36}$/i.test(input.orderId||"")||
    !Array.isArray(input.postUrls)||input.postUrls.length<1||input.postUrls.length>10)
    return Response.json({error:"invalid_order_or_posts"},{status:422});
  // Trust only an independently paid, settled PayKings record, not webhook payment claims.
  const query="SELECT id,package_id,platform,price_cents,gateway_transaction_id,"+
    "profile_ref,customer_id,email,package_items,auto_fulfillment_enabled "+
    "FROM public.litix_growth_bundle_orders WHERE id=$1 AND "+
    "payment_provider='paykings' AND payment_state='settled' "+
    "AND settled_at IS NOT NULL AND gateway_transaction_id IS NOT NULL";
  const paid=(await db.$queryRawUnsafe<LegacyPaid[]>(query,input.orderId))[0];
  if(!paid)return Response.json({error:"payment_not_verified"},{status:403});
  if(paid.auto_fulfillment_enabled)
    return Response.json({error:"legacy_dispatch_owned_order"},{status:409});
  const platform:Platform=paid.platform==="Instagram"?"INSTAGRAM":
    paid.platform==="TikTok"?"TIKTOK":(()=>{throw Error("UNSUPPORTED_PLATFORM")})();
  const bundle=await db.bundlePlan.findUnique({where:{id:paid.package_id},
    include:{parts:{orderBy:{ordinal:"asc"}}}});
  if(!bundle||!bundle.enabled||bundle.platform!==platform||
    bundle.priceCents!==paid.price_cents)
    return Response.json({error:"missing_or_mismatched_bundle_plan"},{status:409});
  if(bundle.parts.reduce((n,x)=>n+x.retailShareCents,0)!==paid.price_cents)
    return Response.json({error:"bundle_price_allocation_mismatch"},{status:409});
  const snapshot=paid.package_items as Record<string,unknown>;
  let profile:string,posts:string[];
  try{
    profile=parseProfile(paid.profile_ref,platform);
    posts=[...new Set(input.postUrls.map(x=>parsePost(x,platform,profile)))];
    if(posts.length!==input.postUrls.length)throw Error("duplicate_posts");
    if(bundle.parts.some(p=>!Number.isSafeInteger(p.quantity)||p.quantity<1||
      !Number.isSafeInteger(p.retailShareCents)||p.retailShareCents<0||
      Number(snapshot[p.kind[0]+p.kind.slice(1).toLowerCase()])!==p.quantity))
      throw Error("bundle_snapshot_mismatch");
  }catch{return Response.json({error:"invalid_target_or_bundle_snapshot"},{status:422});}
  const legs:{componentOrdinal:number;splitIndex:number;kind:ServiceKind;
    platform:Platform;link:string;quantity:number;remaining:number;retailShareCents:number}[]=[];
  for(const part of bundle.parts){
    const split=targetsFor(part.kind,part.quantity,profile,posts);
    split.forEach((item,i)=>{
      const share=Math.floor(part.retailShareCents/split.length)+
        (i<part.retailShareCents%split.length?1:0);
      legs.push({componentOrdinal:part.ordinal,splitIndex:item.splitIndex,
        platform,kind:part.kind,link:item.link,quantity:item.quantity,
        remaining:item.quantity,retailShareCents:share});
    });
  }
  if(legs.length>31)return Response.json({error:"too_many_child_orders"},{status:422});
  const customerId=paid.customer_id||
    "email:"+createHash("sha256").update(paid.email.toLowerCase()).digest("hex");
  let master;
  try{
    master=await db.masterOrder.create({data:{
      id:paid.id,paymentReference:paid.gateway_transaction_id,
      bundleId:bundle.id,paidCents:paid.price_cents,customerId,
      profileUrl:profile,postUrls:posts,paidAt:new Date(),
      children:{create:legs}
    },include:{children:{select:{id:true}}}});
  }catch(error){
    if(!(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002"))throw error;
    master=await db.masterOrder.findUniqueOrThrow({where:{id:paid.id},
      include:{children:{select:{id:true}}}});
    if(master.paymentReference!==paid.gateway_transaction_id)
      return Response.json({error:"payment_identity_conflict"},{status:409});
  }
  const outcomes:PromiseSettledResult<string>[]=[];
  if(process.env.LITIX_WARRIOR_DISPATCH_ENABLED==="true"){
    for(let i=0;i<master.children.length;i+=4)
      outcomes.push(...await Promise.allSettled(master.children.slice(i,i+4).map(c=>dispatch(c.id))));
  }
  return Response.json({orderId:master.id,childCount:master.children.length,
    dispatched:outcomes.filter(x=>x.status==="fulfilled"&&x.value==="SUBMITTED").length,
    state:process.env.LITIX_WARRIOR_DISPATCH_ENABLED==="true"?"PROCESSING":"STAGED"},
    {status:202,headers:{"cache-control":"no-store"}});
}
