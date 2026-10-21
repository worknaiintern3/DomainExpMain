import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: nginx serves apps/landing/out directly, no Node process.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
