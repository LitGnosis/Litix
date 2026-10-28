import {handleBoosteroOrder} from "../../../../lib/boosteroOrderHandler.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(request){
 let data;
 try{data=await request.clone().json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
 const id=String(data?.serviceId||"");
 if(!/^boostero_[0-9]{1,12}$/.test(id)){
  // No retired supplier fallback, no card or supplier request.
  return Response.json({error:"Only verified Boostero services are available for new orders. No charge attempted."},{status:409});
 }
 const body={...data,serviceId:id.slice("boostero_".length),destination:data?.link,action:"card_purchase"};
 const url=new URL(request.url);
 return handleBoosteroOrder(new Request(url,{method:"POST",headers:{"content-type":"application/json",
   ...(request.headers.get("origin")?{"origin":request.headers.get("origin")}:{})},
   body:JSON.stringify(body)}),{adminOnly:false});
}
