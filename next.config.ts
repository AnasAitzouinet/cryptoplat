import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        hostname: 'ipfs.io',
      }
    ]
  }
};

export default nextConfig;
