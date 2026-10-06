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
	/** Browser 30 seconds, CDN 1 minute (current catalog identity and data status). */
	shortLived: "public, max-age=30, s-maxage=60",
	/** Release-addressed content that can never change (search manifest for a matching releaseId). */
	immutable: "public, max-age=31536000, immutable",
	/** Browser 5 minutes, CDN 2 hours (provider price histories and provider misses). */
	priceHistory: "public, max-age=300, s-maxage=7200, stale-while-revalidate=300",
	/** Browser 1 hour, CDN 1 day (IDs the current catalog cannot serve). */
	catalogMiss: "public, max-age=3600, s-maxage=86400",
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

/** Item views with source errors or missing labels stay retryable instead of entering shared caches. */
export function isCompleteItemView(payload: {
	errors?: Record<string, string | null>;
	presentationError?: string;
	bartersError?: string | null;
	craftsError?: string | null;
	itemsError?: string | null;
	pricesError?: string | null;
}): boolean {
	return (
		Object.values(payload.errors ?? {}).every((error) => error === null) &&
		!payload.presentationError &&
		!payload.bartersError &&
		!payload.craftsError &&
		!payload.itemsError &&
		!payload.pricesError
	);
}
