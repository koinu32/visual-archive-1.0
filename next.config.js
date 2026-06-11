/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "usdmrfbwmvjboxwipvix.supabase.co",
      },
    ],
  },
};

module.exports = nextConfig;
