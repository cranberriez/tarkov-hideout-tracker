"use client";

import { useCallback, useMemo } from "react";
import { useQueries, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useGameDataEnabled } from "@/lib/query/game-data";
import { isPriceItemId, type PriceScope } from "@/lib/query/price-contract";
import type { TarkovDataMode } from "@/types/common";
import type { CurrentPrice } from "@/types/prices";
import { canonicalPriceIds, itemPriceQueryOptions, type PriceState } from "./deferred-prices";

export function useItemPrices(mode: TarkovDataMode, itemIds: readonly string[], scope?: PriceScope) {
    const client = useQueryClient();
    const enabled = useGameDataEnabled(mode);
    const ids = useMemo(() => canonicalPriceIds(itemIds).filter(isPriceItemId), [itemIds]);
    const combine = useCallback((results: UseQueryResult<CurrentPrice | null, Error>[]) => {
        const value: PriceState = { state: "ready", prices: {}, states: {} };
        let fetching = false;
        results.forEach((result, index) => {
            const id = ids[index];
            const state = !enabled ? "pending" : result.data !== undefined ? "ready" : result.isError ? "error" : "pending";
            value.states[id] = state;
            if (enabled && result.data) value.prices[id] = result.data;
            if (state === "pending" && value.state !== "error") value.state = "pending";
            if (result.isError && enabled) value.state = "error";
            fetching ||= result.isFetching;
        });
        return { ...value, fetching };
    }, [enabled, ids]);
    const result = useQueries({
        queries: ids.map((id) => ({ ...itemPriceQueryOptions(client, mode, id, scope), enabled })),
        combine,
    });
    const refresh = useCallback(() => {
        const requested = new Set(ids);
        return client.invalidateQueries({ predicate: (query) =>
            query.queryKey[0] === "game-data" && query.queryKey[1] === mode &&
            query.queryKey[2] === "item-price" && requested.has(String(query.queryKey[3])),
        }, { cancelRefetch: false });
    }, [client, ids, mode]);
    return { ...result, refresh, enabled };
}
