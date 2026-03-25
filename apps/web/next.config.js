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
    if (isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'maplibre-gl': false,
      }
    }
    return config
  },
  transpilePackages: ['@conflict-ops/shared'],
}
module.exports = nextConfig
