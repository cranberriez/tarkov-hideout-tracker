import { queryOptions } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { gameDataKey } from "../../../lib/query/scope";
import { fetchJson, requireComplete } from "../../../lib/query/request";
import { isCompleteItemUsageData } from "../../../lib/utils/item-usage";
import type { ItemAcquisitionTreeData, ItemRelationsPayload, ItemUsageData } from "@/types/contracts";

const DETAIL_STALE_TIME = 60_000;
const DETAIL_GC_TIME = 5 * 60_000;
const DETAIL_QUERY_LIMIT = 60;
function scopedItemViewQueryOptions<T>({ mode, itemId, domain, path, complete, partialMessage }: {
    mode: TarkovJsonGameMode;
    itemId: string;
    domain: "relations" | "usage" | "acquisition";
    path: string;
    complete: (payload: T) => boolean;
    partialMessage: string;
}) {
    return queryOptions({
        queryKey: gameDataKey(mode, `item-detail-${domain}`, itemId),
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({ mode });
            const payload = await fetchJson<T>(
                `/api/items/${encodeURIComponent(itemId)}/${path}?${params}`,
                { signal },
            );
            return requireComplete(payload, complete, partialMessage);
        },
        staleTime: DETAIL_STALE_TIME,
        gcTime: DETAIL_GC_TIME,
        retry: false,
        meta: { retentionGroup: "item-detail", inactiveQueryLimit: DETAIL_QUERY_LIMIT },
    });
}

export function itemRelationsQueryOptions(mode: TarkovJsonGameMode, itemId: string) {
    return scopedItemViewQueryOptions<ItemRelationsPayload>({ mode, itemId, domain: "relations", path: "relations", complete: (payload) => Object.values(payload.errors).every((error) => error === null), partialMessage: "Some hideout or quest relations are unavailable." });
}

export function itemUsageQueryOptions(mode: TarkovJsonGameMode, itemId: string) {
    return scopedItemViewQueryOptions<ItemUsageData>({ mode, itemId, domain: "usage", path: "usage", complete: isCompleteItemUsageData, partialMessage: "Some trader or crafting data is unavailable." });
}

export function itemAcquisitionQueryOptions(mode: TarkovJsonGameMode, itemId: string) {
    return scopedItemViewQueryOptions<ItemAcquisitionTreeData>({ mode, itemId, domain: "acquisition", path: "acquisition-tree", complete: (payload) => Object.values(payload.errors).every((error) => error === null), partialMessage: "Some profit recommendation data is unavailable." });
}
