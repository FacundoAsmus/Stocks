import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.finnhub.io" }],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
