import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    // "Contracts & support" was split into Setup → Support and Setup → Contracts
    return [{ source: "/settings/delivery", destination: "/settings/support", permanent: true }];
  },
};

export default nextConfig;
