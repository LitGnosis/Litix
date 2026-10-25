import { Auth0Client } from "@auth0/nextjs-auth0/server";

export function customerLoginEnabled() {
  return process.env.LITIX_CUSTOMER_LOGIN_ENABLED === "true";
}
export function customerAuthConfigured() {
  return customerLoginEnabled() &&
    ["AUTH0_DOMAIN","AUTH0_CLIENT_ID","AUTH0_CLIENT_SECRET","AUTH0_SECRET","APP_BASE_URL"].every(name=>Boolean(process.env[name]));
}
// No Auth0 routes, cookies, or account access are enabled when configuration is incomplete.
export const auth0 = customerAuthConfigured() ? new Auth0Client() : null;

export async function authenticatedCustomer() {
  if (!auth0) return null;
  const session = await auth0.getSession();
  const user = session?.user;
  if (!user || !user.sub || user.email_verified !== true || typeof user.email !== "string") return null;
  return {id:user.sub,email:user.email.toLowerCase(),name:typeof user.name==="string"?user.name:"Customer"};
}
