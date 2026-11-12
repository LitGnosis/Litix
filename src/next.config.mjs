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
  async redirects(){
   return [
    {source:"/refund-policy",destination:"/refunds",permanent:false},
    // Retired public social-engagement storefronts now resolve to owned digital products.
    // Order history, tracking, and cancellation/manage endpoints remain intact.
    ...["/services","/autolikes","/bundles","/bundles/checkout",
      "/custom-likes","/custom-orders",
      "/tools/tiktok-engagement","/solutions","/for-creators",
      "/for-businesses","/for-individuals"].map(source=>({
        source,destination:"/shop",permanent:false
      })),
    {source:"/custom-followers",destination:"/followers",permanent:false},
    {source:"/for-agencies",destination:"/agency",permanent:false},
    {source:"/solutions/:slug",destination:"/shop",permanent:false},
    {source:"/global/:locale",destination:"/shop",permanent:false},
    {source:"/shop/:platform/:kind",destination:"/shop",permanent:false}
   ];
  },

  // Temporary recovery settings requested for the Litix deployment.
  // Keep runtime/security validation in place; these only skip build-time lint/type gates.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
