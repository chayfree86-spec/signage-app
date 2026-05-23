import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow requests from tunnel/proxy services (localtunnel, ngrok, etc.)
  // Next.js 16 checks the Host header; '*' allows all origins in dev mode
  allowedDevOrigins: ["*"],
};

export default nextConfig;
