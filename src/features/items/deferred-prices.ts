import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { gameDataKey } from "../../lib/query/scope";
import { fetchJson, ResponseValidationError } from "../../lib/query/request";
import { canonicalPriceIds, isPriceItemId, PRICE_BATCH_LIMIT, PRICE_GC_TIME, PRICE_STALE_TIME, type PriceResponse, type PriceScope } from "../../lib/query/price-contract";
import type { TarkovDataMode } from "@/types/common";
import type { CurrentPrice } from "@/types/prices";

export { canonicalPriceIds };
export type PriceState = {
    state: "pending" | "error" | "ready";
    prices: Record<string, CurrentPrice>;
    states: Record<string, "pending" | "error" | "ready">;
};

type PendingPrice = {
    id: string;
    signal: AbortSignal;
    refresh: boolean;
    resolve: (price: CurrentPrice | null) => void;
    reject: (error: unknown) => void;
};

// Query owns each item's freshness, in-flight deduplication and cancellation.
// This queue only combines transport for queries started in the same turn.
const queues = new WeakMap<QueryClient, Map<string, PendingPrice[]>>();

async function sendBatch(mode: TarkovDataMode, entries: PendingPrice[], scope?: PriceScope) {
    const live = entries.filter((entry) => !entry.signal.aborted);
    for (const entry of entries) if (entry.signal.aborted) entry.reject(entry.signal.reason);
    if (!live.length) return;
    const controller = new AbortController();
    const cancel = () => {
        if (live.every((entry) => entry.signal.aborted)) controller.abort();
    };
    live.forEach((entry) => entry.signal.addEventListener("abort", cancel));
    try {
        const params = new URLSearchParams({ mode });
        if (scope) params.set("scope", scope);
        else params.set("ids", canonicalPriceIds(live.map(({ id }) => id)).join(","));
        const payload = await fetchJson<PriceResponse>(`/api/items/prices?${params}`, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
            ...(live.some((entry) => entry.refresh) ? {
                cache: "no-cache" as const,
                headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
            } : {}),
        });
        if (!payload || !Array.isArray(payload.itemIds) || !payload.prices || typeof payload.prices !== "object" || Array.isArray(payload.prices) ||
            payload.itemIds.some((id) => typeof id !== "string" || !isPriceItemId(id)) ||
            live.some(({ id }) => !payload.itemIds.includes(id)) ||
            Object.entries(payload.prices).some(([id, price]) => !payload.itemIds.includes(id) || !price || typeof price !== "object" || Array.isArray(price))) {
            throw new ResponseValidationError("Invalid price response");
        }
        // Missing prices are explicit null cache entries, never zero-valued prices.
        for (const entry of live) {
            if (entry.signal.aborted) entry.reject(entry.signal.reason);
            else entry.resolve(payload.prices[entry.id] ?? null);
        }
    } catch (error) {
        live.forEach((entry) => entry.reject(error));
    } finally {
        live.forEach((entry) => entry.signal.removeEventListener("abort", cancel));
    }
}

function queuePrice(client: QueryClient, mode: TarkovDataMode, id: string, signal: AbortSignal, scope?: PriceScope) {
    const refresh = client.getQueryState(gameDataKey(mode, "item-price", id))?.isInvalidated ?? false;
    let clientQueues = queues.get(client);
    if (!clientQueues) queues.set(client, clientQueues = new Map());
    const queueKey = `${mode}:${scope ?? "ids"}`;
    let entries = clientQueues.get(queueKey);
    if (!entries) {
        entries = [];
        clientQueues.set(queueKey, entries);
        const batch = entries;
        setTimeout(async () => {
            clientQueues.delete(queueKey);
            if (scope) void sendBatch(mode, batch, scope);
            else {
                // Explicit subsets keep URLs bounded. Checklist pages use one named scope.
                for (let start = 0; start < batch.length; start += PRICE_BATCH_LIMIT * 3) {
                    await Promise.all([0, 1, 2].map((offset) => sendBatch(mode,
                        batch.slice(start + offset * PRICE_BATCH_LIMIT, start + (offset + 1) * PRICE_BATCH_LIMIT))));
                }
            }
        }, 0);
    }
    return new Promise<CurrentPrice | null>((resolve, reject) => entries.push({ id, signal, refresh, resolve, reject }));
}

export function itemPriceQueryOptions(client: QueryClient, mode: TarkovDataMode, itemId: string, scope?: PriceScope) {
    return queryOptions({
        queryKey: gameDataKey(mode, "item-price", itemId),
        queryFn: ({ signal }) => queuePrice(client, mode, itemId, signal, scope),
        staleTime: PRICE_STALE_TIME,
        gcTime: PRICE_GC_TIME,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
    });
}
