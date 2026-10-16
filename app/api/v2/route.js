import { NextResponse } from 'next/server';
import { getServices } from '../../../lib/provider';
import { authenticateApiKey, wallet, placeWalletOrder, refreshOrderStatus, requestRefill, refillStatus, requestCancel } from '../../../lib/panel';

export const dynamic='force-dynamic';
async function params(req){
  if(req.method==='GET') return Object.fromEntries(new URL(req.url).searchParams.entries());
  const ct=req.headers.get('content-type')||'';
  if(ct.includes('application/json')) return await req.json();
  return Object.fromEntries(new URLSearchParams(await req.text()));
}
const respond=(body,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});
function apiStatus(order){
  if(!order)return null;
  const s=String(order.provider_status||order.fulfillment_status||'Pending');
  return {charge:(Number(order.retail_cents||0)/100).toFixed(2),start_count:String(order.start_count??0),status:s,remains:String(order.provider_remains??order.quantity??0),currency:'USD'};
}
async function handle(req){
  try{
    const p=await params(req); const user=await authenticateApiKey(p.key);
    if(!user)return respond({error:'Invalid API key'},401);
    const action=String(p.action||'').toLowerCase();
    if(action==='services'){
      const services=await getServices();
      return respond(services.map(s=>({service:Number(s.publicId),name:s.name,type:s.type||'Default',category:`${s.platform} - ${s.kind}`,rate:Number(s.retailRateUsd.toFixed(6)),min:s.min,max:s.max,refill:s.refill,cancel:s.cancel,dripfeed:s.dripfeed})));
    }
    if(action==='balance'){
      const w=await wallet(user); return respond({balance:(Number(w.balance_cents||0)/100).toFixed(2),currency:w.currency||'USD'});
    }
    if(action==='add'){
      const result=await placeWalletOrder(user,{serviceId:String(p.service),target:p.link||p.target||p.username,quantity:p.quantity,runs:p.runs,interval:p.interval,comments:p.comments,usernames:p.usernames,keywords:p.keywords,hashtag:p.hashtag,media:p.media,username:p.username,min:p.min,max:p.max,posts:p.posts,old_posts:p.old_posts,delay:p.delay,expiry:p.expiry,answer_number:p.answer_number});
      return respond({order:result.order,charge:result.charge,currency:result.currency});
    }
    if(action==='status'&&p.order){const o=await refreshOrderStatus(user,String(p.order));if(!o)return respond({error:'Incorrect order ID'},404);return respond(apiStatus(o));}
    if(action==='status'&&p.orders){const ids=String(p.orders).split(',').map(x=>x.trim()).filter(Boolean).slice(0,100);const out={};for(const id of ids){const o=await refreshOrderStatus(user,id);out[id]=o?apiStatus(o):{error:'Incorrect order ID'};}return respond(out);}
    if(action==='refill'&&p.order){const r=await requestRefill(user,String(p.order));return respond({refill:r.refill});}
    if(action==='refill'&&p.orders){const ids=String(p.orders).split(',').map(x=>x.trim()).filter(Boolean).slice(0,100);const out=[];for(const id of ids){try{const r=await requestRefill(user,id);out.push({order:id,refill:r.refill})}catch(e){out.push({order:id,refill:{error:e.message}})}}return respond(out);}
    if(action==='refill_status'&&p.refill){const r=await refillStatus(user,String(p.refill));if(!r)return respond({error:'Incorrect refill ID'},404);return respond({status:r.status});}
    if(action==='refill_status'&&p.refills){const ids=String(p.refills).split(',').map(x=>x.trim()).filter(Boolean).slice(0,100);const out=[];for(const id of ids){const r=await refillStatus(user,id);out.push({refill:id,status:r?r.status:{error:'Refill not found'}})}return respond(out);}
    if(action==='cancel'){const r=await requestCancel(user,String(p.order||''));return respond({cancel:r.cancellation,status:r.status});}
    return respond({error:'Incorrect request'},400);
  }catch(err){console.error('api_v2_error',err?.message||err);return respond({error:String(err?.message||'Request failed')},err?.status||400);}
}
export async function POST(req){return handle(req)}
export async function GET(req){return handle(req)}
