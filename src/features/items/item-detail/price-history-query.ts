import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { gameDataKey } from "../../../lib/query/scope";
import { fetchJson } from "../../../lib/query/request";
import type { ItemPriceHistoryPayload } from "@/types/contracts";
import type { PriceHistoryPoint } from "@/types/prices";

export const HISTORY_STALE_TIME = 2 * 60 * 60 * 1000;

export function priceHistoryQueryOptions(itemId: string, mode: TarkovJsonGameMode) {
    return queryOptions({
        queryKey: gameDataKey(mode, "item-price-history", itemId),
        queryFn: async ({ signal }) => {
            const payload = await fetchJson<ItemPriceHistoryPayload>(
                `/api/items/${encodeURIComponent(itemId)}/price-history?mode=${encodeURIComponent(mode)}`,
                { signal },
            );
            if (!Array.isArray(payload.data)) throw new Error("Price history is temporarily unavailable.");
            return payload.data;
        },
        staleTime: HISTORY_STALE_TIME,
        gcTime: HISTORY_STALE_TIME,
        retry: false,
        meta: { retentionGroup: "item-detail", inactiveQueryLimit: 60 },
    });
}

export function getCachedPriceHistoryAvailability(queryClient: QueryClient, itemId: string, mode: TarkovJsonGameMode) {
    const cached = queryClient.getQueryData<PriceHistoryPoint[]>(priceHistoryQueryOptions(itemId, mode).queryKey);
    return cached ? cached.length > 0 : null;
}
