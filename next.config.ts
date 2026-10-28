import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.24.46", "192.168.1.117"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

