import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		// 31 days to limit image optimization transformations
		minimumCacheTTL: 2678400,
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
	allowedDevOrigins: ['192.168.2.13'],
};

export default nextConfig;
