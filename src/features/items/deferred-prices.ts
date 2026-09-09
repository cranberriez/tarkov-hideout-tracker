import { queryOptions } from "@tanstack/react-query";
import { gameDataKey } from "../../lib/query/scope";
import { fetchJson } from "../../lib/query/request";
import type { TarkovDataMode } from "@/types/common";
import type { CurrentPrice } from "@/types/prices";

export type PriceState = {
    state: "pending" | "error" | "ready";
    prices: Record<string, CurrentPrice>;
};

type PriceResponse = {
    prices: Record<string, CurrentPrice>;
};

export function canonicalPriceIds(itemIds: readonly string[]) {
    return [...new Set(itemIds)].sort();
}

export async function fetchDeferredPrices(
    mode: TarkovDataMode,
    itemIds: readonly string[],
    signal: AbortSignal,
): Promise<Record<string, CurrentPrice>> {
    const ids = canonicalPriceIds(itemIds);
    const prices: Record<string, CurrentPrice> = {};
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
    for (let start = 0; start < ids.length; start += 384) {
        const batches = [0, 128, 256]
            .map((offset) => ids.slice(start + offset, start + offset + 128))
            .filter((batch) => batch.length > 0);
        const results = await Promise.all(batches.map(async (batch) => {
            const payload = await fetchJson<PriceResponse>("/api/items/prices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, ids: batch }),
                signal: requestSignal,
            });
            if (!payload.prices || typeof payload.prices !== "object" || Array.isArray(payload.prices) ||
                Object.entries(payload.prices).some(([id, price]) =>
                    !batch.includes(id) || !price || typeof price !== "object" || Array.isArray(price))) {
                throw new Error("Invalid price response");
            }
            return payload.prices;
        }));
        for (const result of results) Object.assign(prices, result);
    }
    return prices;
}

export function deferredPricesQueryOptions(mode: TarkovDataMode, itemIds: readonly string[]) {
    const ids = canonicalPriceIds(itemIds);
    return queryOptions({
        queryKey: gameDataKey(mode, "deferred-prices", ids),
        queryFn: ({ signal }) => fetchDeferredPrices(mode, ids, signal),
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: false,
        meta: { retentionGroup: "deferred-prices", inactiveQueryLimit: 20 },
    });
}
