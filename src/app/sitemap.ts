import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { DEFAULT_TARKOV_JSON_GAME_MODE } from "@/lib/game-mode";
import { isIndexableHost, SITE_URL } from "@/lib/seo";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";
import { getSitemapPaths } from "@/server/queries/getSitemapPaths";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	if (!isIndexableHost((await headers()).get("host"))) return [];
	const paths = await getSitemapPaths(await getCurrentPageRepository(DEFAULT_TARKOV_JSON_GAME_MODE));
	return paths.map((path) => ({ url: new URL(path, SITE_URL).href }));
}
