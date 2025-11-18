import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,   // ← THIS FIXES THE PNG SEQUENCE
  },
};

export default nextConfig;