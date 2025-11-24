import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "assets.tarkov.dev",
            },
            {
                protocol: "https",
                hostname: "game-cdn.tarkov.dev",
            },
        ],
    },
};

export default nextConfig;
