"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { MarketPrice } from "@/types";
import type { GameMode } from "@/lib/stores/useUserStore";

export interface PriceDataContextValue {
    marketPricesByMode: Record<
        GameMode,
        {
            prices: Record<string, MarketPrice | null>;
            updatedAt: number | null;
        }
    >;
    loading: boolean;
}

const PriceDataContext = createContext<PriceDataContextValue | null>(null);

interface PriceDataProviderProps {
    value: PriceDataContextValue;
    children: ReactNode;
}

export function PriceDataProvider({ value, children }: PriceDataProviderProps) {
    return <PriceDataContext.Provider value={value}>{children}</PriceDataContext.Provider>;
}

export function usePriceDataContext(): PriceDataContextValue {
    const ctx = useContext(PriceDataContext);
    if (!ctx) {
        throw new Error(
            "usePriceDataContext must be used within PriceDataLayout PriceDataContext.Provider"
        );
    }
    return ctx;
}
