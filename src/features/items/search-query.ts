import { queryOptions } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "../../lib/game-mode";
import { gameDataKey } from "../../lib/query/scope";
import {
    fetchJson,
    ResponseValidationError,
    shouldRetryRequest,
} from "../../lib/query/request";
import { normalizeName } from "../../lib/utils/normalize-name";
import type { ItemSearchPayload } from "../../types/contracts";
import type { ItemSummary } from "../../types/items";

export const ITEM_SEARCH_DEBOUNCE_MS = 200;

export function canonicalItemSearchQuery(query: string): string {
    return normalizeName(query.trim());
}

function isItemSummary(value: unknown): value is ItemSummary {
    return Boolean(
        value &&
        typeof value === "object" &&
        "id" in value &&
        typeof value.id === "string" &&
        "name" in value &&
        typeof value.name === "string" &&
        "normalizedName" in value &&
        typeof value.normalizedName === "string",
    );
}

export function itemSearchQueryOptions(
    mode: TarkovJsonGameMode,
    query: string,
    resultLimit: number,
) {
    const canonicalQuery = canonicalItemSearchQuery(query);
    return queryOptions({
        queryKey: gameDataKey(mode, "item-search", resultLimit, canonicalQuery),
        queryFn: async ({ signal }) => {
            const params = new URLSearchParams({
                mode,
                q: canonicalQuery,
                limit: String(resultLimit),
            });
            const payload = await fetchJson<ItemSearchPayload>(`/api/items/search?${params}`, { signal });
            if (!Array.isArray(payload.items) || payload.items.some((item) => !isItemSummary(item))) {
                throw new ResponseValidationError("The server returned an invalid item search response.", payload);
            }
            return payload;
        },
        staleTime: 60_000,
        gcTime: 5 * 60 * 1000,
        retry: shouldRetryRequest,
        meta: { retentionGroup: "search", inactiveQueryLimit: 20 },
    });
}
