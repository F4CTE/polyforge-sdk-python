import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@polyforge/ui'],
  eslint: { ignoreDuringBuilds: false },
  async rewrites() {
    return [
      {
        source: '/auth/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:4000'}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
