import { Auth0Client } from "@auth0/nextjs-auth0/server";

export function customerLoginEnabled() {
  return process.env.LITIX_CUSTOMER_LOGIN_ENABLED === "true";
}
export function neonSelected() {
  return process.env.LITIX_IDENTITY_PROVIDER === "neon";
}
export function customerAuthConfigured() {
  if (!customerLoginEnabled()) return false;
  if (neonSelected()) {
    // An explicitly selected alternate provider is only available when its
    // connection and session-signing secret have both been set.
    const url=process.env.NEON_AUTH_BASE_URL||"";
    try { const parsed=new URL(url);
      return parsed.protocol==="https:" && parsed.hostname.endsWith(".neon.tech") &&
        parsed.pathname.endsWith("/auth") &&
        String(process.env.NEON_AUTH_COOKIE_SECRET||"").length>=32;
    } catch { return false }
  }
  const sandbox=["preview","development"].includes(process.env.VERCEL_ENV);
  const mandatory=["AUTH0_DOMAIN","AUTH0_CLIENT_ID","AUTH0_CLIENT_SECRET","AUTH0_SECRET"];
  return mandatory.every(k=>Boolean(process.env[k])) &&
    /^[a-f0-9]{64}$/i.test(process.env.AUTH0_SECRET||"") &&
    (sandbox || /^https:\/\/[^/]+\/?$/.test(process.env.APP_BASE_URL||""));
}
export const auth0 = !neonSelected() && customerAuthConfigured() ? new Auth0Client() : null;
export function customerSigninUrl() { return neonSelected()?"/account/sign-in":"/auth/login?returnTo=%2Faccount" }
export function customerSignupUrl() { return neonSelected()?"/account/sign-up":"/auth/login?screen_hint=signup&returnTo=%2Faccount" }
export async function authenticatedCustomer() {
  if (!customerAuthConfigured()) return null;
  if (neonSelected()) {
    const { getNeonCustomerAuth } = await import("./neonCustomerAuth.js");
    const instance=getNeonCustomerAuth();
    if(!instance)return null;
    const {data:session,error}=await instance.getSession();
    if(error)return null;
    const user=session?.user;
    if(!user?.id || user.emailVerified!==true || typeof user.email!=="string")return null;
    return {id:"neon:"+user.id,email:user.email.toLowerCase(),name:typeof user.name==="string"?user.name:"Customer"};
  }
  if(!auth0)return null;
  const session=await auth0.getSession();
  const user=session?.user;
  if(!user?.sub || user.email_verified!==true || typeof user.email!=="string")return null;
  return {id:user.sub,email:user.email.toLowerCase(),name:typeof user.name==="string"?user.name:"Customer"};
}
