import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow requests from tunnel/proxy services (localtunnel, ngrok, etc.)
  // Next.js 16 checks the Host header; '*' allows all origins in dev mode
  allowedDevOrigins: ["*"],
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/screen",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
