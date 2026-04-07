const isDevelopment = process.env.NODE_ENV === "development";
const devPort = process.env.PORT || process.env.npm_config_port || "3000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  ...(isDevelopment ? { distDir: `.next-dev-${devPort}` } : {}),
};

export default nextConfig;
