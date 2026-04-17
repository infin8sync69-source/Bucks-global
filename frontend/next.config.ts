import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // ── Server-side proxy for the Python backend ────────────────────────────────
  // All browser API calls are routed through /api/proxy/* and the Next.js
  // server forwards them to the backend.  This eliminates CORS issues entirely
  // and makes the app work when accessed from another device on the LAN —
  // because the Next.js server (not the browser) makes the backend request.
  // Production: set NEXT_PUBLIC_API_URL to your Railway/cloud backend URL.
  async rewrites() {
    const backendUrl = (
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    ).replace(/\/+$/, "");
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      // Public IPFS gateways — explicit hostnames, no wildcards
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "gateway.ipfs.io" },
      { protocol: "https", hostname: "cloudflare-ipfs.com" },
      { protocol: "https", hostname: "dweb.link" },
      // Supabase storage
      { protocol: "https", hostname: "*.supabase.co" },
      // Custom deployment gateway
      { protocol: "https", hostname: "ipfs.bucks.global" },
      // Local development
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
