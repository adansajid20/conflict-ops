const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  // Monorepo: resolve modules from root node_modules
  webpack: (config, { isServer }) => {
    // Server: stub out browser-only modules
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'maplibre-gl': false,
      }
    }

    // Resolve from root node_modules (Vercel monorepo compat)
    config.resolve.modules = [
      ...(config.resolve.modules || ['node_modules']),
      path.resolve(__dirname, '../../node_modules'),
    ]

    return config
  },
  transpilePackages: ['@conflict-ops/shared'],
}
module.exports = nextConfig
