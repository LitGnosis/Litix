/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep private order tokens out of referrer headers and prevent
  // clickjacking without changing PayKings' third-party card-field origins.
  async headers(){
   return [{source:"/(.*)",headers:[
    {key:"Referrer-Policy",value:"no-referrer"},
    {key:"X-Content-Type-Options",value:"nosniff"},
    {key:"X-Frame-Options",value:"DENY"},
    {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"}
   ]}];
  },
  async rewrites(){
   // The historic /privacy route has been returning platform 404s in production.
   // Route it before filesystem matching to the identical public legal content.
   return {beforeFiles:[{source:"/privacy",destination:"/legal/privacy"}],
    afterFiles:[],fallback:[]};
  },
  // Restore all social storefront routes. Retire ONLY unavailable AutoLikes public pages.
  async redirects(){return [
   {source:"/refund-policy",destination:"/refunds",permanent:false},
   {source:"/autolikes",destination:"/shop",permanent:false},
   {source:"/autolikes/prepaid",destination:"/shop",permanent:false},
   {source:"/autolikes/prepaid/checkout",destination:"/shop",permanent:false}
  ];},

  // Temporary recovery settings requested for the Litix deployment.
  // Keep runtime/security validation in place; these only skip build-time lint/type gates.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
