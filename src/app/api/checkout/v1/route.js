import { POST as checkout } from "../../[action]/route.js";
import {handleBoosteroOrder} from "../../../../lib/boosteroOrderHandler.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request) {
  // A unique namespaced ID ensures every existing numeric SMMGLOB checkout stays on its original path.
  let data;
  try{data=await request.clone().json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
  const id=String(data?.serviceId||"");
  if(/^boostero_[0-9]{1,12}$/.test(id)){
    const body={...data,serviceId:id.slice(8),destination:data?.link,action:"card_purchase"};
    const url=new URL(request.url);
    return handleBoosteroOrder(new Request(url,{method:"POST",headers:{"content-type":"application/json",
      ...(request.headers.get("origin")?{"origin":request.headers.get("origin")}:{})},body:JSON.stringify(body)}),{adminOnly:false});
  }
  const url = new URL(request.url);
  url.pathname = "/api/checkout";
  return checkout(new Request(url, request));
}
