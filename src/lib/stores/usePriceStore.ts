"use client";

import { create } from "zustand";
import type { MarketPrice, TimedResponse } from "@/types";

const PRICE_CLIENT_CACHE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes, mirror route headers

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

        const { prices, updatedAt, loading } = get();

        // If we already have fresh data for all requested names, no need to hit the API.
        const cacheFresh = !!updatedAt && Date.now() - updatedAt < PRICE_CLIENT_CACHE_WINDOW_MS;
        if (cacheFresh) {
            const allPresent = names.every((name) =>
                Object.prototype.hasOwnProperty.call(prices, name)
            );
            if (allPresent) {
                return;
            }
        }

        // Avoid stacking multiple in-flight requests for the same batch very aggressively.
        if (loading && cacheFresh) {
            return;
        }

        // Only request names that are missing from the cache when it is otherwise fresh.
        const namesToRequest = cacheFresh
            ? names.filter((name) => !Object.prototype.hasOwnProperty.call(prices, name))
            : names;

        if (namesToRequest.length === 0) return;

        set({ loading: true, error: null });

        try {
            const res = await fetch("/api/market/items", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ items: namesToRequest }),
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
