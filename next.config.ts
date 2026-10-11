import type { NextConfig } from 'next';
const nextConfig: NextConfig = { serverExternalPackages: ['node:sqlite'], poweredByHeader: false, devIndicators: false };
export default nextConfig;
