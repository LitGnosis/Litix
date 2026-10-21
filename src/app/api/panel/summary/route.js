import {NextResponse} from 'next/server';
import {requireAccount,wallet,accountOrders,listApiKeys} from '../../../../lib/panel';
import {providerHealth,markupMultiplier} from '../../../../lib/provider';
export const dynamic='force-dynamic';
export async function GET(req){try{const u=requireAccount(req);const [w,orders,keys,providers]=await Promise.all([wallet(u),accountOrders(u),listApiKeys(u),providerHealth()]);return NextResponse.json({user:{id:u.sub,email:u.email,name:u.name||''},wallet:w,orders,keys,providers,markup:markupMultiplier(),apiEndpoint:'/api/v2'});}catch(e){return NextResponse.json({error:e.message},{status:e.status||500})}}
