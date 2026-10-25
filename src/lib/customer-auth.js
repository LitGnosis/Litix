import {Auth0Client} from '@auth0/nextjs-auth0/server';
import {previewAccountsAllowed} from './monthly-checkout-config.mjs';
let client;
export function customerAuth(){
 if(!previewAccountsAllowed())return null;
 const base=process.env.APP_BASE_URL;
 if(!base||!process.env.AUTH0_DOMAIN||!process.env.AUTH0_CLIENT_ID||!process.env.AUTH0_CLIENT_SECRET||!process.env.AUTH0_SECRET)return null;
 // Explicitly configured callback origin; do not trust arbitrary incoming hosts.
 const url=new URL(base);if(url.protocol!=='https:')return null;
 return client??=new Auth0Client({appBaseUrl:base,enableAccessTokenEndpoint:false,authorizationParameters:{scope:'openid profile email'}});
}
