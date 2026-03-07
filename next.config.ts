import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  compress: true,
  experimental: {
    optimizePackageImports: ["@octokit/rest", "openai"],
  },
};

export default nextConfig;
