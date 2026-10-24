// Pure simulation: no gateway, database, supplier, or network access.
export const plans=Object.freeze([
 {likes:100,cents:560},{likes:150,cents:800},{likes:250,cents:1200},
 {likes:1000,cents:3200},{likes:2000,cents:5600}
].map(Object.freeze));
export function nextMonth(value){
 const date=new Date(value),day=date.getUTCDate();
 date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);
 const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
 date.setUTCDate(Math.min(day,last));return date.toISOString();
}
export function signup(likes,consent,now){
 const plan=plans.find(p=>p.likes===likes);
 if(!plan||consent!==true)throw Error('Choose a plan and explicitly consent to monthly renewal.');
 return {sandbox:true,likes,amountCents:plan.cents,currency:'USD',status:'active',autoRenew:true,periodStart:new Date(now).toISOString(),periodEnd:nextMonth(now),charges:1,deliveries:[],dailyLimit:3};
}
export function cancel(state){return {...state,autoRenew:false,status:'cancel_at_period_end'};}
export function renew(state,now,approved=true){
 if(new Date(now)<new Date(state.periodEnd))throw Error('Current billing period has not ended.');
 if(!state.autoRenew)return {...state,status:'expired'};
 if(!approved)return {...state,status:'past_due'};
 return {...state,status:'active',periodStart:new Date(now).toISOString(),periodEnd:nextMonth(now),charges:state.charges+1};
}
export function coverPost(state,postId,now){
 if(!['active','cancel_at_period_end'].includes(state.status)||new Date(now)<new Date(state.periodStart)||new Date(now)>=new Date(state.periodEnd))throw Error('No paid coverage at this time.');
 if(typeof postId!=='string'||!postId.trim())throw Error('Enter a post ID.');
 if(state.deliveries.some(p=>p.id===postId))return state;
 const day=new Date(now).toISOString().slice(0,10);
 if(state.deliveries.filter(p=>p.day===day).length>=3)throw Error('Daily limit reached: 3 posts per UTC calendar day.');
 return {...state,deliveries:[...state.deliveries,{id:postId,day,likes:state.likes,simulated:true}]};
}
