import {timingSafeEqual} from "node:crypto";
export function authorizedCron(request){
 const secret=String(process.env.CRON_SECRET||"");
 const provided=String(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 return secret.length>=24&&secret.length===provided.length&&
  timingSafeEqual(Buffer.from(secret),Buffer.from(provided));
}
export const cronReply=(value,status=200)=>Response.json(value,{status,
 headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
