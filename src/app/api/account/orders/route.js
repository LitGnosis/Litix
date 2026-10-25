import { GET as dashboard } from "../dashboard/route.js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 const response=await dashboard();
 if(!response.ok)return response;
 const body=await response.json();
 return Response.json({orders:body.orders},{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
}
