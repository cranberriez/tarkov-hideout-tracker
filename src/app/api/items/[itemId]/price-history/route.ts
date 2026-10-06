import { NextRequest, NextResponse } from "next/server";
import { readItemRouteParams } from "@/app/api/_lib/item-params";
import { CacheControl } from "@/app/api/_lib/cache-control";
import { getCachedCatalogItems } from "@/server/db/catalog-cache";
import { getCatalogVersion } from "@/server/db/postgres-read";
import { fetchCachedJsonPriceHistory } from "@/server/prices/live-price-history";

export const revalidate = 7200;

export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
	const params = await readItemRouteParams(request, context);
	if (!params.ok) return params.response;
	const { mode, itemId } = params;

	try {
		// Only catalog items reach the provider; unknown IDs are answered locally and cached.
		const catalog = await getCachedCatalogItems(mode, await getCatalogVersion(mode));
		if (!catalog.data[itemId]) {
			return NextResponse.json(
				{ error: "Price history is not available for this item" },
				{ status: 404, headers: { "Cache-Control": CacheControl.catalogMiss } },
			);
		}
		const data = await fetchCachedJsonPriceHistory(mode, itemId);
		if (!data) {
			return NextResponse.json(
				{ error: "Price history is not available for this item" },
				{ status: 404, headers: { "Cache-Control": CacheControl.priceHistory } },
			);
		}
		return NextResponse.json(
			{ data, fetchedAt: Date.now() },
			{ headers: { "Cache-Control": CacheControl.priceHistory } },
		);
	} catch {
		return NextResponse.json(
			{ error: "Price history is temporarily unavailable" },
			{ status: 502, headers: { "Cache-Control": CacheControl.privateNoStore } },
		);
	}
}
