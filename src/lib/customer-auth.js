import {Auth0Client} from '@auth0/nextjs-auth0/server';
import {authSettings} from './customer-policy.mjs';
let client;
export function customerAuth(){
 const settings=authSettings();if(!settings)return null;
 return client??=new Auth0Client({...settings,enableAccessTokenEndpoint:false,authorizationParameters:{scope:'openid profile email'},session:{rolling:true,inactivityDuration:3600,absoluteDuration:86400,cookie:{secure:true,sameSite:'lax'}}});
}
