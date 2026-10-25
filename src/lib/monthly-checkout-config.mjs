import {monthlySandboxConfig} from './monthly-gateway-config.mjs';
// Enabling a flag in Production must never enable this experimental journey.
export function previewAccountsAllowed(env=process.env){
 return env.VERCEL_ENV==='preview' && env.LITIX_CUSTOMER_ACCOUNTS_ENABLED==='true' && env.LITIX_CUSTOMER_DATABASE_VERIFIED==='true';
}
export function monthlyCheckoutConfig(env=process.env){
 if(!previewAccountsAllowed(env)||env.LITIX_MONTHLY_PURCHASE_ENABLED!=='true')throw Error('Sandbox checkout unavailable');
 monthlySandboxConfig(env);
 if(!env.NMI_TEST_TOKENIZATION_KEY||!env.LITIX_MONTHLY_DATABASE_URL||!env.RESEND_API_KEY||!env.EMAIL_FROM)throw Error('Sandbox integration incomplete');
 const date=env.LITIX_MONTHLY_APPROVED_START_DATE;
 if(!/^\d{4}-\d{2}-(0[1-9]|1\d|2[0-8])$/.test(date||'')||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date<=new Date().toISOString().slice(0,10))throw Error('Future approved first-charge date required');
 return {publicKey:env.NMI_TEST_TOKENIZATION_KEY,startDate:date};
}
