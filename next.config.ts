import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El PDF del estado de cuenta se sube con una server action
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
