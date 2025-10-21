import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables static export mode (replaces `next export`)
  output: "export",

  // You can still keep other experimental flags if needed
  experimental: {
    // example: ppr: true, serverActions: true, etc.
  },
};

export default nextConfig;
