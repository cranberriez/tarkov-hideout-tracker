"use client";

import { create } from "zustand";
import type { MarketPrice, TimedResponse } from "@/types";

interface PriceState {
    prices: Record<string, MarketPrice | null>;
    loading: boolean;
    error: string | null;
    updatedAt: number | null;

    fetchPrices: (normalizedNames: string[]) => Promise<void>;
    getPrice: (normalizedName: string) => MarketPrice | null | undefined;
}

export const usePriceStore = create<PriceState>((set, get) => ({
    prices: {},
    loading: false,
    error: null,
    updatedAt: null,

    getPrice: (normalizedName) => {
        const { prices } = get();
        return prices[normalizedName];
    },

    fetchPrices: async (normalizedNames: string[]) => {
        const names = Array.from(
            new Set(normalizedNames.map((n) => n.trim()).filter((n) => n.length > 0))
        );

        if (names.length === 0) return;

        set({ loading: true, error: null });

        try {
            const res = await fetch("/api/market/items", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ items: names }),
            });

            if (!res.ok) throw new Error("Failed to fetch market prices");

            const json = (await res.json()) as TimedResponse<Record<string, MarketPrice | null>>;

            set((state) => ({
                prices: {
                    ...state.prices,
                    ...json.data,
                },
                loading: false,
                updatedAt: json.updatedAt,
            }));
        } catch (error) {
            console.error(error);
            set({ loading: false, error: "Failed to load market prices" });
        }
    },
}));
