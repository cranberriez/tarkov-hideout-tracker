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
	async redirects() {
		return [
			{
				// Legacy quest deep links; the quests index keeps a client fallback for streamed responses.
				source: "/quests",
				has: [{ type: "query", key: "quest", value: "(?<questId>[^&]+)" }],
				destination: "/quests/:questId",
				permanent: true,
			},
		];
	},
};

export default nextConfig;
