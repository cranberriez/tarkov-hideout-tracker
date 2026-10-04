import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { PriceHistoryPoint } from "@/types/prices";
import { boundedReadCache } from "../db/read-cache";
import { normalizePriceHistory } from "../services/priceHistory";
import { TARKOV_API_HEADERS } from "../services/tarkovApi";

const PRICE_HISTORY_REQUEST_TIMEOUT_MS = 8_000;

export const PRICE_HISTORY_REVALIDATE_SECONDS = 2 * 60 * 60;

interface UpstreamPriceResponse {
	data?: unknown;
}

/** Provider history for one item, or null when the provider has none (404). */
export async function fetchJsonPriceHistory(
	mode: TarkovJsonGameMode,
	itemId: string,
): Promise<PriceHistoryPoint[] | null> {
	const response = await fetch(`https://json.tarkov.dev/${mode}/prices/${encodeURIComponent(itemId)}`, {
		headers: TARKOV_API_HEADERS,
		// The surrounding read cache stores both histories and provider 404s.
		cache: "no-store",
		signal: AbortSignal.timeout(PRICE_HISTORY_REQUEST_TIMEOUT_MS),
	});
	if (response.status === 404) return null;
	if (!response.ok) {
		throw new Error(`Price history request failed with status ${response.status}`);
	}
	const body = (await response.json()) as UpstreamPriceResponse;
	return normalizePriceHistory(body.data);
}

/** Two-hour cached provider history; misses are cached too so repeated lookups never reach the provider. */
export function fetchCachedJsonPriceHistory(
	mode: TarkovJsonGameMode,
	itemId: string,
	cache?: typeof import("next/cache").unstable_cache,
): Promise<PriceHistoryPoint[] | null> {
	return boundedReadCache(
		["price-history", mode, itemId],
		() => fetchJsonPriceHistory(mode, itemId),
		PRICE_HISTORY_REVALIDATE_SECONDS,
		cache,
	);
}
