// Shared Cache-Control header values for API routes.
export const CacheControl = {
	/** Never cached, including by the browser. */
	privateNoStore: "private, no-store",
	/** Not stored by any cache (partial page data and item-detail responses). */
	noStore: "no-store",
	/** Browser 5 minutes, CDN 1 hour (complete page data, unpriced payloads, current prices). */
	publicCdnHour: "public, max-age=300, s-maxage=3600",
	/** Browser and CDN 5 minutes (priced profit page data). */
	publicCdnFiveMinutes: "public, max-age=300, s-maxage=300",
	/** Browser 5 minutes, CDN 15 minutes with background revalidation (complete item details). */
	itemDetail: "public, max-age=300, s-maxage=900, stale-while-revalidate=300",
	/** Browser 1 hour with day-long background revalidation (map overlays and render data). */
	mapData: "public, max-age=3600, stale-while-revalidate=86400",
	/** Browser 1 day with week-long background revalidation (rendered map SVG). */
	mapSvg: "public, max-age=86400, stale-while-revalidate=604800",
} as const;

/** Unpriced profit data still embeds independently refreshed trader offers. */
export function profitPageDataCacheControl(isComplete: boolean, includesPrices: boolean): string {
	if (!isComplete || !includesPrices) return CacheControl.noStore;
	return CacheControl.publicCdnFiveMinutes;
}
