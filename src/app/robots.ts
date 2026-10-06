import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { isIndexableHost, SITE_URL } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
	const index = isIndexableHost((await headers()).get("host"));
	return {
		// Allow pages to be crawled so engines can see the noindex on nonproduction hosts.
		rules: { userAgent: "*", allow: "/", disallow: "/api/" },
		...(index ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
	};
}
