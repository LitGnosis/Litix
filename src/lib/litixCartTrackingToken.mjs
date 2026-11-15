import {createHmac} from "node:crypto";
export function litixCartTrackingToken(orderId){
 const secret=process.env.LITIX_TRACK_SIGNING_SECRET||"";
 if(secret.length<32||!/^ltx2_[a-f0-9-]{36}$/.test(String(orderId||"")))
  throw Error("cart_tracking_token_unavailable");
 return createHmac("sha256",secret).update("litix-cart-tracking/v1/"+orderId).digest("hex");
}
