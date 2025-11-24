import { create } from "zustand";
import type {
    Station,
    ItemPrice,
    TimedResponse,
    HideoutStationsPayload,
    ItemsPricesPayload,
} from "@/app/types";

interface DataState {
    stations: Station[] | null;
    stationsUpdatedAt: number | null;

    prices: Record<string, ItemPrice> | null;
    pricesUpdatedAt: number | null;

    loadingStations: boolean;
    loadingPrices: boolean;
    errorStations: string | null;
    errorPrices: string | null;

    // Actions
    fetchStations: () => Promise<void>;
    fetchPrices: (ids?: string[]) => Promise<void>;
    setStations: (stations: Station[], updatedAt?: number) => void;
    setPrices: (prices: Record<string, ItemPrice>, updatedAt?: number) => void;
}

export const useDataStore = create<DataState>((set) => ({
    stations: null,
    stationsUpdatedAt: null,
    prices: null,
    pricesUpdatedAt: null,
    loadingStations: false,
    loadingPrices: false,
    errorStations: null,
    errorPrices: null,

    fetchStations: async () => {
        set({ loadingStations: true, errorStations: null });
        try {
            const res = await fetch("/api/hideout/stations");
            if (!res.ok) throw new Error("Failed to fetch stations");

            const json = (await res.json()) as TimedResponse<HideoutStationsPayload>;
            set({
                stations: json.data.stations,
                stationsUpdatedAt: json.updatedAt,
                loadingStations: false,
            });
        } catch (error) {
            console.error(error);
            set({ loadingStations: false, errorStations: "Failed to load stations" });
        }
    },

    fetchPrices: async (ids?: string[]) => {
        set({ loadingPrices: true, errorPrices: null });
        try {
            const params = ids && ids.length > 0 ? `?ids=${ids.join(",")}` : "";
            const res = await fetch(`/api/items/prices${params}`);
            if (!res.ok) throw new Error("Failed to fetch prices");

            const json = (await res.json()) as TimedResponse<ItemsPricesPayload>;
            set((state) => ({
                // Merge prices if we already have some and fetched a subset?
                // Or just replace if it's a full fetch?
                // For simplicity, if we fetch specific IDs, merge. If full fetch, replace.
                prices: ids ? { ...(state.prices || {}), ...json.data } : json.data,
                pricesUpdatedAt: json.updatedAt,
                loadingPrices: false,
            }));
        } catch (error) {
            console.error(error);
            set({ loadingPrices: false, errorPrices: "Failed to load prices" });
        }
    },

    setStations: (stations, updatedAt) =>
        set({ stations, stationsUpdatedAt: updatedAt ?? Date.now() }),
    setPrices: (prices, updatedAt) => set({ prices, pricesUpdatedAt: updatedAt ?? Date.now() }),
}));
