import {createHash,timingSafeEqual} from "node:crypto";
import {cleanPartnerAttribution} from "./litixPartnerAttribution.mjs";

const TEST_DOMAINS=new Set(["example.com","example.org","example.net","test.com","asdf.com","localhost"]);
export const creatorHash=value=>createHash("sha256").update(String(value)).digest("hex");
export function creatorEmail(value){
 if(typeof value!=="string"||value.length>254)return null;
 const input=value.trim().toLowerCase();
 if(input.length<6||!(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(input)))return null;
 const domain=input.split("@")[1];
 if(TEST_DOMAINS.has(domain)||domain.endsWith(".test")||domain.endsWith(".invalid")||/^(asdf|test|dummy)$/i.test(input.split("@")[0]))return null;
 return input;
}
export function creatorSignupInput(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {ok:false,error:"Invalid request"};
 if(raw.websiteTrap)return {ok:true,spam:true};
 const email=creatorEmail(raw.email);
 if(!email||raw.consent!==true)return {ok:false,error:"Enter a valid email and confirm your request"};
 const attribution=cleanPartnerAttribution(raw.attribution);
 return {ok:true,data:{email,attribution}};
}
export function ownerTokenAuthorized(request,secret){
 const token=String(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const a=String(secret||"");
 if(a.length<32||token.length!==a.length)return false;
 return timingSafeEqual(Buffer.from(creatorHash(token),"hex"),Buffer.from(creatorHash(a),"hex"));
}
export const creatorDbUrl=()=>process.env.LITIX_GROWTH_DATABASE_URL||process.env.LITIX_V2_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL||"";
