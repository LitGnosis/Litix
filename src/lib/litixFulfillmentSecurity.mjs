import {createHash,createHmac,timingSafeEqual} from "node:crypto";

export const LITIX_ORDER_ID=/^ltx2_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const VALID_TRANSACTION=/^[A-Za-z0-9-]{3,100}$/;
const hash=(data)=>createHash("sha256").update(data).digest("hex");
const equalHex=(a,b)=>typeof a==="string"&&typeof b==="string"&&
 /^[a-f0-9]{64}$/i.test(a)&&/^[a-f0-9]{64}$/i.test(b)&&
 timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));

/**
 * NMI Webhook-Signature format: t=<nonce>,s=<HMAC SHA256 hex>.
 * The signed bytes are nonce + "." + the exact raw HTTP body.
 * NMI's "t" is a nonce, not an epoch timestamp.
 */
export function verifyPayKingsWebhook(raw,header,signingKey){
 if(typeof raw!=="string"||Buffer.byteLength(raw)>65536||typeof signingKey!=="string"||
    signingKey.length<24)return false;
 const match=/^t=([a-zA-Z0-9._:-]{1,200}),s=([a-f0-9]{64})$/i.exec(String(header||"").trim());
 if(!match)return false;
 return equalHex(createHmac("sha256",signingKey).update(match[1]+"."+raw).digest("hex"),match[2]);
}
export function parsePaidWebhook(raw){
 let event;
 try{event=JSON.parse(raw)}catch{return null}
 const body=event?.event_body;
 if(!event||typeof event!=="object"||!body||typeof body!=="object")return null;
 if(!["transaction.sale.success","transaction.capture.success"].includes(event.event_type))return null;
 if(body.features?.is_test_mode===true||String(body.currency||"USD").toUpperCase()!=="USD")return null;
 if(String(body.success)!=="1"||String(body.response_code)!=="100")return null;
 if(!LITIX_ORDER_ID.test(String(body.order_id||""))||
    !VALID_TRANSACTION.test(String(body.transaction_id||""))||
    !/^[a-f0-9-]{36}$/i.test(String(event.event_id||"")))return null;
 if(!["pendingsettlement","complete"].includes(String(body.condition||"").toLowerCase()))return null;
 const amount=Number(body.amount??body.requested_amount);
 const amountCents=Math.round(amount*100);
 if(!Number.isFinite(amount)||!Number.isSafeInteger(amountCents)||amountCents<100||
    Math.abs(amount*100-amountCents)>0.001)return null;
 return {eventId:String(event.event_id),type:event.event_type,
  transactionId:String(body.transaction_id),orderId:String(body.order_id),
  amountCents,bodyHash:hash(raw)};
}
const tag=(xml,name)=>new RegExp("<"+name+">([^<]{0,150})</"+name+">","i").exec(xml)?.[1]?.trim()||"";
/**
 * Independently verify the transaction against NMI Query API. A signed webhook
 * is a notification, not sufficient evidence to spend the supplier wallet.
 */
export async function verifyCapturedLitixSale({orderId,transactionId,amountCents,securityKey,fetcher=fetch}){
 if(!LITIX_ORDER_ID.test(String(orderId||""))||!VALID_TRANSACTION.test(String(transactionId||""))||
    !Number.isSafeInteger(amountCents)||amountCents<100||String(securityKey||"").length<16)return false;
 const response=await fetcher("https://paykings.transactiongateway.com/api/query.php",{
  method:"POST",cache:"no-store",redirect:"error",
  headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({security_key:securityKey,report_type:"transaction",transaction_id:transactionId}),
  signal:AbortSignal.timeout(11000)
 });
 if(!response.ok)throw Error("payment_lookup_unavailable");
 const xml=await response.text();
 if(!xml||xml.length>160000)throw Error("payment_lookup_malformed");
 const transaction=/<transaction(?:\s[^>]*)?>([\s\S]*?)<\/transaction>/i.exec(xml)?.[1]||"";
 if(tag(transaction,"transaction_id")!==transactionId||tag(transaction,"order_id")!==orderId||
   (tag(transaction,"currency")&&tag(transaction,"currency").toUpperCase()!=="USD")||
   (tag(transaction,"transaction_type")&&tag(transaction,"transaction_type")!=="cc"))return false;
 const condition=tag(transaction,"condition").toLowerCase();
 if(!["pendingsettlement","complete"].includes(condition))return false;
 const actions=[...transaction.matchAll(/<action(?:\s[^>]*)?>([\s\S]*?)<\/action>/gi)].map(x=>x[1]);
 if(actions.some(x=>["refund","void","credit","return"].includes(tag(x,"action_type").toLowerCase())&&tag(x,"success")==="1"))return false;
 return actions.some(x=>(["sale","capture"].includes(tag(x,"action_type").toLowerCase())&&
   tag(x,"success")==="1"&&tag(x,"response_code")==="100"&&
   Math.round(Number(tag(x,"amount"))*100)===amountCents));
}
export function issueTrackingToken(orderId,secret=process.env.LITIX_TRACK_SIGNING_SECRET){
 if(!LITIX_ORDER_ID.test(String(orderId||""))||String(secret||"").length<32)
  throw Error("tracking_unavailable");
 const payload=Buffer.from(orderId,"utf8").toString("base64url");
 const signature=createHmac("sha256",secret).update("litix-private-v1:"+payload).digest("hex");
 return "v1."+payload+"."+signature;
}
export function decodeTrackingToken(token,secret=process.env.LITIX_TRACK_SIGNING_SECRET){
 const m=/^v1\.([A-Za-z0-9_-]{20,95})\.([a-f0-9]{64})$/i.exec(String(token||""));
 if(!m||String(secret||"").length<32)return null;
 const expected=createHmac("sha256",secret).update("litix-private-v1:"+m[1]).digest("hex");
 if(!equalHex(expected,m[2]))return null;
 try{const id=Buffer.from(m[1],"base64url").toString("utf8");return LITIX_ORDER_ID.test(id)?id:null}
 catch{return null}
}
export const secureTrackUrl=id=>"https://www.litix.net/track/"+issueTrackingToken(id);
