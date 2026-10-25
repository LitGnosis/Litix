export const dynamic='force-dynamic';
export default function Login(){
 return <main className="wrap"><section className="panel"><h1>Customer sign in · Preview</h1><p>Sign in securely with Auth0. Litix does not collect your password.</p><p><a href="/auth/login?returnTo=%2Faccount">Sign in</a></p><p><a href="/auth/login?screen_hint=signup&returnTo=%2Faccount">Create an account</a></p><h2>Forgot your password?</h2><p>Choose Sign in, then “Forgot password” on the Auth0 screen. Recovery and verification emails are sent by Auth0, not this page. Use your verification email before accessing account records.</p><a href="/">Return to storefront</a></section></main>;
}
