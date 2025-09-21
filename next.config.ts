import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration options can be added here as needed
  allowedDevOrigins: [
    "100.66.20.194",
    "localhost:3000",
    "127.0.0.1:3000"
  ]
};

export default nextConfig;
