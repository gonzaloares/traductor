import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/traductor',
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
