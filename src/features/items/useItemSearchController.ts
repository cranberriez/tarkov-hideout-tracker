"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled } from "@/lib/query/game-data";
import {
    canonicalItemSearchQuery,
    ITEM_SEARCH_DEBOUNCE_MS,
    itemSearchQueryOptions,
} from "@/features/items/search-query";

export function useItemSearchController({
    enabled,
    mode,
    query,
    resultLimit,
}: {
    enabled: boolean;
    mode: TarkovJsonGameMode;
    query: string;
    resultLimit: number;
}) {
    const gameDataEnabled = useGameDataEnabled(mode);
    const canonicalQuery = canonicalItemSearchQuery(query);
    const [debouncedQuery, setDebouncedQuery] = useState("");

    useEffect(() => {
        if (!enabled || !canonicalQuery) {
            return;
        }
        const timer = window.setTimeout(
            () => setDebouncedQuery(canonicalQuery),
            ITEM_SEARCH_DEBOUNCE_MS,
        );
        return () => window.clearTimeout(timer);
    }, [canonicalQuery, enabled]);

    const observedQuery = enabled ? canonicalQuery : "";
    const hasCurrentDebouncedQuery = Boolean(canonicalQuery) && debouncedQuery === canonicalQuery;
    const queryEnabled = enabled && gameDataEnabled && hasCurrentDebouncedQuery;
    const result = useQuery({
        ...itemSearchQueryOptions(mode, observedQuery, resultLimit),
        enabled: queryEnabled,
    });
    const resultError = queryEnabled ? result.error : null;
    const hasSearchIntent = enabled && Boolean(canonicalQuery);
    const items = queryEnabled && result.data ? result.data.items : [];

    return {
        items,
        isLoading:
            hasSearchIntent &&
            !resultError &&
            (!queryEnabled || result.isPending || result.isFetching),
        error: resultError
            ? resultError.message || "Item search could not be loaded."
            : null,
        retry: () => result.refetch(),
        hasNoResults:
            queryEnabled && result.isSuccess && result.data.items.length === 0,
    };
}
