"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { TarkovDataMode } from "@/types/common";
import type { ItemSummary } from "@/types/items";
import { isPriceItemId, type PriceScope } from "@/lib/query/price-contract";
import type { PriceState } from "./deferred-prices";
import { useItemPrices } from "./useItemPrices";

const Context = createContext<PriceState | null>(null);

export function PriceRefreshControl({ delivery }: { delivery: ReturnType<typeof useItemPrices> }) {
    if (!delivery.enabled || Object.keys(delivery.states).length === 0) return null;
    return <div className="fixed bottom-4 right-4 z-40 rounded border border-highlight/10 bg-card px-4 py-2 text-xs text-muted-foreground shadow-lg">
        <span role="status">{delivery.fetching ? "Loading item prices…" : delivery.state === "error" ? "Prices could not be updated. " : ""}</span>
        {!delivery.fetching && <button type="button" className="underline" onClick={() => void delivery.refresh()}>
            {delivery.state === "error" ? "Retry prices" : "Refresh prices"}
        </button>}
    </div>;
}

export function DeferredPriceBoundary({ mode, itemIds, scope, children }: {
    mode: TarkovDataMode;
    itemIds: string[];
    scope?: PriceScope;
    children: ReactNode;
}) {
    const delivery = useItemPrices(mode, itemIds, scope);
    const value = useMemo(() => ({ state: delivery.state, prices: delivery.prices, states: delivery.states }),
        [delivery.state, delivery.prices, delivery.states]);
    return (
        <Context.Provider value={value}>
            <PriceRefreshControl delivery={delivery} />
            {children}
        </Context.Provider>
    );
}

export function useDeferredPriceItems(items: ItemSummary[] | null) {
    const delivery = useContext(Context);
    return useMemo(() => !delivery ? items : items?.map((item) => ({
        ...item,
        marketPrice: delivery.prices[item.id] ?? null,
        priceLoadState: delivery.states[item.id] ?? (isPriceItemId(item.id) ? "pending" : "ready"),
    })) ?? null, [items, delivery]);
}
