import {POST as lookup} from "../[action]/route.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
export function POST(request){
 const u=new URL(request.url);
 u.pathname="/api/lookup-order";
 return lookup(new Request(u,request));
}
