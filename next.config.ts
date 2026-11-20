import type { NextConfig } from "next";

/**
 * Link-preview crawlers (anchored, case-sensitive; non-capturing so no params are created).
 * Search-engine bots are deliberately absent: they index the static canonical page.
 */
const SEASON_PREVIEW_BOTS =
	".*(?:Discordbot|redditbot|Twitterbot|facebookexternalhit|Slackbot|Slack-ImgProxy|TelegramBot|WhatsApp|LinkedInBot|Embedly|Iframely|SkypeUriPreview|vkShare|Mastodon|Bluesky|Pinterestbot).*";

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
	allowedDevOrigins: ["192.168.2.13"],
	async headers() {
		return [
			{
				source: "/images/generated-artwork/:path*",
				headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
			},
		];
	},
	// Season preview images read the bundled modifier icons from disk.
	outputFileTracingIncludes: {
		"/og/**": ["./public/images/season-*/modifiers/*.webp"],
	},
	async rewrites() {
		return {
			// Before static pages, or the prerendered season page would always win.
			beforeFiles: [
				{
					// Link-preview crawlers opening a season build link get tiny per-build preview HTML
					// (src/app/og-share); people and search engines never match and get the static page.
					source: "/:season(season-1|season-2)",
					destination: "/og-share/:season",
					has: [
						{ type: "query", key: "b" },
						{ type: "header", key: "user-agent", value: SEASON_PREVIEW_BOTS },
					],
				},
			],
			afterFiles: [
				{
					// Same-origin item art, so the screenshot uploader can compare icon pixels on a canvas.
					source: "/item-assets/:path*",
					destination: "https://assets.tarkov.dev/:path*",
				},
			],
			fallback: [],
		};
	},
};

export default nextConfig;
