import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        hostname: 'ipfs.io',
      },
      {
        hostname: 'metadata.pumployer.fun',
      }
    ]
  }
};

export default nextConfig;
