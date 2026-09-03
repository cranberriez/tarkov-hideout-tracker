import { normalizeName } from "../../lib/utils/normalize-name";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import {
    ITEM_SEARCH_MAX_QUERY_LENGTH,
    ITEM_SEARCH_QUICK_RESULT_LIMIT,
    type ItemSearchPayload,
} from "../../types/contracts";
import type { ItemSummary } from "@/types/items";
import { getDefaultRepository } from "./query-utils";

export const ITEM_SEARCH_RESULT_LIMIT = ITEM_SEARCH_QUICK_RESULT_LIMIT;

export function isValidItemSearchQuery(query: string): boolean {
    const trimmedQuery = query.trim();
    return (
        trimmedQuery.length > 0 &&
        trimmedQuery.length <= ITEM_SEARCH_MAX_QUERY_LENGTH &&
        normalizeName(trimmedQuery).length > 0
    );
}

export async function searchItems(
    query: string,
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
    resultLimit = ITEM_SEARCH_RESULT_LIMIT,
): Promise<ItemSearchPayload> {
    if (!isValidItemSearchQuery(query)) {
        throw new RangeError("Item search query must be between 1 and 80 characters.");
    }

    const dataRepository = repository ?? (await getDefaultRepository());
    const catalog = await dataRepository.items.getCatalog(mode);
    const normalizedQuery = normalizeName(query);
    const compactQuery = normalizedQuery.replace(/-/g, "");
    const items: ItemSummary[] = catalog.data.filter((item) => {
        const normalizedItemName = normalizeName(item.name);
        const normalizedCatalogName = normalizeName(item.normalizedName);
        return (
            normalizedItemName.includes(normalizedQuery) ||
            normalizedCatalogName.includes(normalizedQuery) ||
            normalizedCatalogName.replace(/-/g, "").includes(compactQuery)
        );
    });

    items.sort((left, right) => {
        const leftStartsWith = normalizeName(left.name).startsWith(normalizedQuery);
        const rightStartsWith = normalizeName(right.name).startsWith(normalizedQuery);
        if (leftStartsWith !== rightStartsWith) return leftStartsWith ? -1 : 1;
        return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });

    return { items: items.slice(0, resultLimit) };
}
