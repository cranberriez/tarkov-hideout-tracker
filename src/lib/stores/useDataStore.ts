import { create } from "zustand";
import type { Station, TimedResponse, HideoutStationsPayload, ItemDetails, ItemsPayload } from "@/types";

interface DataState {
	stations: Station[] | null;
	stationsUpdatedAt: number | null;

	items: Record<string, ItemDetails> | null;
	itemsUpdatedAt: number | null;

	loadingStations: boolean;
	loadingItems: boolean;
	errorStations: string | null;
	errorItems: string | null;

	// Actions
	fetchStations: () => Promise<void>;
	fetchItems: () => Promise<void>;
	setStations: (stations: Station[], updatedAt?: number) => void;
	setItems: (items: Record<string, ItemDetails>, updatedAt?: number) => void;
}

export const useDataStore = create<DataState>((set) => ({
	stations: null,
	stationsUpdatedAt: null,
	items: null,
	itemsUpdatedAt: null,
	loadingStations: false,
	loadingItems: false,
	errorStations: null,
	errorItems: null,

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

	fetchItems: async () => {
		set({ loadingItems: true, errorItems: null });
		try {
			const res = await fetch("/api/items");
			if (!res.ok) throw new Error("Failed to fetch items");

			const json = (await res.json()) as TimedResponse<ItemsPayload>;

			// Convert array to Record<id, ItemDetails>
			const itemsMap: Record<string, ItemDetails> = {};
			json.data.items.forEach((item) => {
				itemsMap[item.id] = item;
			});

			set({
				items: itemsMap,
				itemsUpdatedAt: json.updatedAt,
				loadingItems: false,
			});
		} catch (error) {
			console.error(error);
			set({ loadingItems: false, errorItems: "Failed to load items" });
		}
	},

	setStations: (stations, updatedAt) => set({ stations, stationsUpdatedAt: updatedAt ?? Date.now() }),
	setItems: (items, updatedAt) => set({ items, itemsUpdatedAt: updatedAt ?? Date.now() }),
}));
