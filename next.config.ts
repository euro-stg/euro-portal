import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  watchOptions: {
    pollIntervalMs: 1000,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "talenta.oss-ap-southeast-5.aliyuncs.com",
      },
    ],
  },
};

export default nextConfig;
