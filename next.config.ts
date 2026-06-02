import type { NextConfig } from "next";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://lapaletixa.local:8080";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.87", "lapaletixa.local", "lapaletixa.localhost", "lapaletixa.jegdev.com"],
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/files/:path*",
        destination: `${BACKEND_URL}/files/:path*`,
      },
    ];
  },
};

export default nextConfig;
