/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow phones/tablets on the office LAN to load dev-server assets
  // (Next.js 15 blocks cross-origin /_next/* requests in dev by default).
  allowedDevOrigins: [
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*', '172.17.*.*', '172.18.*.*', '172.19.*.*',
    '172.2*.*.*', '172.30.*.*', '172.31.*.*',
  ],
};
export default nextConfig;
