import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // In production, pages are served under /parts by Express custom server
  basePath: dev ? "" : "/parts",
  // Silence "multiple lockfiles" warning — root is the monorepo parent
  outputFileTracingRoot: dev ? undefined : "/app",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "nyc3.digitaloceanspaces.com" },
      { protocol: "https", hostname: "316-garage-uploads.nyc3.digitaloceanspaces.com" },
    ],
  },
  async rewrites() {
    if (!dev) return []; // In production, Express handles API directly (same process)
    // In development, proxy API calls to parts-store Express server
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
