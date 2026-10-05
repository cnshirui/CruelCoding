import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["read-excel-file", "unzipper"],
  // Kept so links to the page before the RedPocket rename still work.
  async redirects() {
    return [{ source: "/red-packets", destination: "/red-pockets", permanent: true }];
  },
};

export default nextConfig;
