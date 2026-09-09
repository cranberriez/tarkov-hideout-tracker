"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGameDataEnabled } from "@/lib/query/game-data";
import type { TarkovDataMode } from "@/types/common";
import type { ItemSummary } from "@/types/items";
import { canonicalPriceIds, deferredPricesQueryOptions, type PriceState } from "./deferred-prices";

const pending: PriceState = { state: "pending", prices: {} };
const Context = createContext<PriceState | null>(null);

export function DeferredPriceBoundary({ mode, itemIds, children }: {
    mode: TarkovDataMode;
    itemIds: string[];
    children: ReactNode;
}) {
    const gameDataEnabled = useGameDataEnabled(mode);
    const ids = useMemo(() => canonicalPriceIds(itemIds), [itemIds]);
    const pricesQuery = useQuery({
        ...deferredPricesQueryOptions(mode, ids),
        enabled: gameDataEnabled && ids.length > 0,
    });
    const value: PriceState = ids.length === 0
        ? { state: "ready", prices: {} }
        : !gameDataEnabled
            ? pending
            : pricesQuery.error
                ? { state: "error", prices: {} }
                : pricesQuery.data
                    ? { state: "ready", prices: pricesQuery.data }
                    : pending;
    const retry = () => {
        void pricesQuery.refetch();
    };

    return (
        <Context.Provider value={value}>
            {ids.length > 0 && value.state !== "ready" && (
                <div role="status" className="fixed bottom-4 right-4 z-40 rounded border border-highlight/10 bg-card px-4 py-2 text-xs text-muted-foreground shadow-lg">
                    {value.state === "pending" ? "Loading item prices…" : <>
                        Item prices could not be loaded. <button type="button" className="underline" onClick={retry}>Retry prices</button>
                    </>}
                </div>
            )}
            {children}
        </Context.Provider>
    );
}

export function useDeferredPriceItems(items: ItemSummary[] | null) {
    const delivery = useContext(Context);
    return useMemo(() => !delivery ? items : items?.map((item) => ({
        ...item,
        marketPrice: delivery.prices[item.id] ?? null,
        priceLoadState: delivery.state,
    })) ?? null, [items, delivery]);
}
