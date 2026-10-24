/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Temporary recovery settings requested for the Litix deployment.
  // Keep runtime/security validation in place; these only skip build-time lint/type gates.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
