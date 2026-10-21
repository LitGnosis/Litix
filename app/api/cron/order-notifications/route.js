import {queueTrackingUpdates,deliverOrderNotifications} from '../../../../lib/orderNotifications';
export const runtime='nodejs',dynamic='force-dynamic',maxDuration=30;
export async function GET(req){
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return Response.json({error:'Unauthorized'},{status:401});
 try{await queueTrackingUpdates();return Response.json({ok:true,...await deliverOrderNotifications()},{headers:{'Cache-Control':'no-store'}})}catch(e){console.error('order_notification_worker',e.message);return Response.json({error:'Try later'},{status:503})}
}
