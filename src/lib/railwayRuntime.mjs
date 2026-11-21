// Explicit host-agnostic production gate. Railway is opt-in and never trusted by default.
export function isApprovedProductionCheckoutRuntime(env = process.env) {
  if (env.VERCEL_ENV === "production") return true;
  return env.RAILWAY_ENVIRONMENT_NAME === "production" &&
    env.LITIX_RAILWAY_PRODUCTION_CHECKOUT_APPROVED === "true";
}
