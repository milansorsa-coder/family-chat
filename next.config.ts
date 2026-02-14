import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // This creates the 'out' folder needed for Android
  images: {
    unoptimized: true, // Required because Android can't run the Next.js image server
  },
};

export default nextConfig;
