"use client";

import { create } from "zustand";
import type { MarketPrice, TimedResponse } from "@/types";
import { useUserStore, type GameMode } from "@/lib/stores/useUserStore";

const PRICE_CLIENT_CACHE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes, mirror route headers

interface PriceState {
    pricesByMode: Record<
        GameMode,
        {
            prices: Record<string, MarketPrice | null>;
            updatedAt: number | null;
        }
    >;
    loading: boolean;
    error: string | null;

    fetchPrices: (normalizedNames: string[]) => Promise<void>;
    getPrice: (normalizedName: string) => MarketPrice | null | undefined;
    getUpdatedAt: () => number | null;
}

export const usePriceStore = create<PriceState>((set, get) => ({
    pricesByMode: {
        PVP: { prices: {}, updatedAt: null },
        PVE: { prices: {}, updatedAt: null },
    },
    loading: false,
    error: null,

    getPrice: (normalizedName) => {
        const { pricesByMode } = get();
        const { gameMode } = useUserStore.getState();
        const mode: GameMode = gameMode === "PVE" ? "PVE" : "PVP";
        const bucket = pricesByMode[mode];
        return bucket?.prices[normalizedName];
    },

    getUpdatedAt: () => {
        const { pricesByMode } = get();
        const { gameMode } = useUserStore.getState();
        const mode: GameMode = gameMode === "PVE" ? "PVE" : "PVP";
        const bucket = pricesByMode[mode];
        return bucket?.updatedAt ?? null;
    },

    fetchPrices: async (normalizedNames: string[]) => {
        const names = Array.from(
            new Set(normalizedNames.map((n) => n.trim()).filter((n) => n.length > 0))
        );

        if (names.length === 0) return;

        const { pricesByMode, loading } = get();
        const { gameMode } = useUserStore.getState();
        const mode: GameMode = gameMode === "PVE" ? "PVE" : "PVP";
        const bucket = pricesByMode[mode];
        const updatedAt = bucket?.updatedAt ?? null;

        // If we already have fresh data for all requested names, no need to hit the API.
        const cacheFresh = !!updatedAt && Date.now() - updatedAt < PRICE_CLIENT_CACHE_WINDOW_MS;
        if (cacheFresh) {
            const allPresent = names.every((name) =>
                Object.prototype.hasOwnProperty.call(bucket?.prices ?? {}, name)
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
            ? names.filter(
                  (name) => !Object.prototype.hasOwnProperty.call(bucket?.prices ?? {}, name)
              )
            : names;

        if (namesToRequest.length === 0) return;

        set({ loading: true, error: null });

        try {
            const res = await fetch("/api/market/items", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ items: namesToRequest, gameMode: mode }),
            });

            if (!res.ok) throw new Error("Failed to fetch market prices");

            const json = (await res.json()) as TimedResponse<Record<string, MarketPrice | null>>;

            set((state) => {
                const nextBucket = state.pricesByMode[mode] ?? {
                    prices: {},
                    updatedAt: null,
                };
                return {
                    pricesByMode: {
                        ...state.pricesByMode,
                        [mode]: {
                            prices: {
                                ...nextBucket.prices,
                                ...json.data,
                            },
                            updatedAt: json.updatedAt,
                        },
                    },
                    loading: false,
                };
            });
        } catch (error) {
            console.error(error);
            set({ loading: false, error: "Failed to load market prices" });
        }
    },
}));
