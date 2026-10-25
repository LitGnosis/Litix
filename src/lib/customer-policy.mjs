export function authSettings(env=process.env){
 if(env.VERCEL_ENV!=='preview'||env.LITIX_CUSTOMER_LOGIN_ENABLED!=='true')return null;
 try{
 // Vercel supplies immutable deployment hostname; never trust incoming Host.
 const base=new URL(env.VERCEL_URL ? "https://"+env.VERCEL_URL : env.APP_BASE_URL);
 if(base.protocol!=='https:'||base.username||base.password||base.port||base.pathname!=='/'||base.search||base.hash)return null;
 if(!env.AUTH0_DOMAIN||!env.AUTH0_CLIENT_ID||!env.AUTH0_CLIENT_SECRET||!/^[a-f0-9]{64}$/i.test(env.AUTH0_SECRET||''))return null;
 return {appBaseUrl:base.origin};
 }catch{return null}
}
export function customerIdentity(session){
 const user=session?.user;
 if(typeof user?.sub!=='string'||!user.sub||user.sub.length>255)return null;
 return {subject:user.sub,email:typeof user.email==='string'?user.email:null,verified:user.email_verified===true};
}
