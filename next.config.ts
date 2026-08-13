import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.24.46"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

