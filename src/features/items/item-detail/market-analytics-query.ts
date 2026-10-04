import { queryOptions } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { gameDataKey } from "../../../lib/query/scope";
import { fetchJson, RequestError } from "../../../lib/query/request";
import type { ItemMarketAnalytics, ItemMarketAnalyticsPayload } from "@/types/contracts";

/** The analyzer runs once or twice a day per mode. */
const ANALYTICS_STALE_TIME = 30 * 60 * 1000;

export function marketAnalyticsQueryOptions(itemId: string, mode: TarkovJsonGameMode) {
	return queryOptions({
		queryKey: gameDataKey(mode, "item-market-analytics", itemId),
		queryFn: async ({ signal }): Promise<ItemMarketAnalytics | null> => {
			try {
				const payload = await fetchJson<ItemMarketAnalyticsPayload>(
					`/api/items/${encodeURIComponent(itemId)}/market-analytics?mode=${encodeURIComponent(mode)}`,
					{ signal },
				);
				if (payload?.data?.itemId !== itemId) throw new Error("Market analytics are temporarily unavailable.");
				return payload.data;
			} catch (error) {
				// Not analyzed in this mode (not on the flea, or no history yet) is an answer, not a failure.
				if (error instanceof RequestError && error.status === 404) return null;
				throw error;
			}
		},
		staleTime: ANALYTICS_STALE_TIME,
		gcTime: 2 * ANALYTICS_STALE_TIME,
		retry: false,
		meta: { retentionGroup: "item-detail", inactiveQueryLimit: 60 },
	});
}
