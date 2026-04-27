import { fileURLToPath } from "node:url";

const isDevelopment = process.env.NODE_ENV === "development";
const devPort = process.env.PORT || process.env.npm_config_port || "3000";
const bigintBufferBrowserEntry = fileURLToPath(new URL("./node_modules/bigint-buffer/dist/browser.js", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: workspaceRoot,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "bigint-buffer": bigintBufferBrowserEntry,
    };
    return config;
  },
  ...(isDevelopment ? { distDir: `.next-dev-${devPort}` } : {}),
};

export default nextConfig;
