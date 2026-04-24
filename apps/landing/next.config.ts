import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@polyforge/ui'],
  async redirects() {
    return [
      {
        source: '/api-docs',
        destination: process.env.APP_URL ?? 'http://localhost:5173/api-docs',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/auth/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:4000'}/auth/:path*`,
      },
    ];
  },
};

// Use CommonJS export so Next.js reads the config object directly.
// ESM `export default` in a .ts file gets transpiled to { __esModule: true, default: {...} }
// which Next.js treats as an unrecognised-key object and silently ignores options like `output`.
module.exports = nextConfig;
