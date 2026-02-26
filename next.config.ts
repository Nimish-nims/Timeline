import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["eddyter"],
  turbopack: {
    resolveAlias: {
      canvas: "./src/lib/canvas-stub.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: path.join(process.cwd(), "src/lib/canvas-stub.ts"),
    };
    return config;
  },
};

export default nextConfig;
