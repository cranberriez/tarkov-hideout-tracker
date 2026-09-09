"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { TarkovDataMode } from "@/types/common";
import type { ItemSummary } from "@/types/items";
import { isPriceItemId, type PriceScope } from "@/lib/query/price-contract";
import type { PriceState } from "./deferred-prices";
import { useItemPrices } from "./useItemPrices";

const Context = createContext<PriceState | null>(null);

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
