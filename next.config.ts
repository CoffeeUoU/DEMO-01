import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // hide the Next.js dev badge in the corner while running `npm run dev`
  devIndicators: false,
  allowedDevOrigins: ["*.lhr.life", "*.app.lhr.life", "*.trycloudflare.com"],
};

export default nextConfig;
