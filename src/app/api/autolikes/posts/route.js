import { db, sha, equalMac, normalizedPost, dispatchLivePost } from "../../../../lib/liveAutoLikes.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const respond=(x,s=200)=>Response.json(x,{status:s,headers:{"cache-control":"no-store"}});
export async function POST(req) {
  if(process.env.LITIX_AUTOLIKES_EVENT_INGEST_ENABLED!=="true")return respond({error:"Event source not enabled"},503);
  const raw=await req.text();
  if(raw.length>4096)return respond({error:"Event too large"},413);
  const signature=(req.headers.get("x-litix-event-signature")||"").replace(/^sha256=/i,"");
  if(!equalMac(raw,signature,process.env.LITIX_AUTOLIKES_EVENT_SECRET))return respond({error:"Unauthorized source"},401);
  let event;try{event=JSON.parse(raw);}catch{return respond({error:"Invalid JSON"},400)}
  const platform=String(event.platform||"").toLowerCase();
  const handle=String(event.profile||"").replace(/^@/,"").toLowerCase();
  const mediaId=String(event.mediaId||"").trim();
  const published=new Date(event.publishedAt);
  if(!["instagram","tiktok"].includes(platform) || !/^[a-z0-9._]{1,30}$/.test(handle)
    || !/^[a-zA-Z0-9_-]{8,180}$/.test(mediaId) || !Number.isFinite(published.getTime())
    || published.getTime()>Date.now()+120000 || published.getTime()<Date.now()-7*86400000)
      return respond({error:"Invalid post event"},422);
  const postUrl=normalizedPost(event.postUrl,platform,handle);
  if(!postUrl)return respond({error:"Invalid post URL"},422);
  const sql=db();
  try{
    const list=await sql.query(
      "select id from litix_autolikes_live_subscriptions where platform=$1 and lower(target_handle)=$2 and status='ACTIVE' and payment_status='PAID' and billing_cycle_end>now() and posts_remaining>0 and last_paid_at <= $3::timestamptz order by created_at asc limit 25",
      [platform,handle,published.toISOString()]
    );
    let accepted=0,duplicate=0,submitted=0,reconcile=0;
    for(const sub of list){
      const id="alp_"+sha(sub.id+"|"+mediaId).slice(0,40);
      const inserted=await sql.query(
        "insert into litix_autolikes_live_posts(id,subscription_id,platform,media_id,post_url) values($1,$2,$3,$4,$5) on conflict do nothing returning id",
        [id,sub.id,platform,mediaId,postUrl]
      );
      if(!inserted.length){duplicate++;continue;}
      accepted++;
      const result=await dispatchLivePost(id);
      if(result.state==="SUBMITTED")submitted++;
      if(result.state==="UNKNOWN_OUTCOME")reconcile++;
    }
    return respond({ok:true,accepted,duplicate,submitted,reconcile});
  }catch(e){
    console.error("AutoLikes event processing failure",String(e?.code||"unavailable"));
    return respond({error:"AutoLikes event storage unavailable"},503);
  }
}