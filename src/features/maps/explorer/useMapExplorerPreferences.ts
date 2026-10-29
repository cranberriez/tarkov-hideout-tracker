"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ArtStyle, Filters } from "../tarkov-map";

export const MAP_EXPLORER_PREFERENCES_KEY = "tarkov-map-explorer-preferences-v1";
/** Saved filter slots in the layers panel. */
export const PRESET_SLOTS = 3;

/** Maps explorer display preferences; shared by every map, profile and mode, outside backups and resets. */
interface MapExplorerPreferences {
	/** Marker filters over the library defaults; null until changed (see `withDefaults`). */
	filters: Filters | null;
	slots: (Filters | null)[];
	layersOpen: boolean;
	collapsed: Record<string, boolean>;
	floorsOpen: boolean;
	art: ArtStyle;
	split: boolean;
	/** Loose loot dots show their most valuable possible item (loads prices). */
	valuableLoot: boolean;
	set: (patch: Partial<Omit<MapExplorerPreferences, "set">>) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === "object" && !Array.isArray(value);

export const useMapExplorerPreferences = create<MapExplorerPreferences>()(
	persist(
		(set) => ({
			filters: null,
			slots: [],
			layersOpen: true,
			collapsed: {},
			floorsOpen: false,
			art: "svg",
			split: false,
			valuableLoot: false,
			set: (patch) => set(patch),
		}),
		{
			name: MAP_EXPLORER_PREFERENCES_KEY,
			version: 1,
			storage: createJSONStorage(() => localStorage),
			partialize: ({ filters, slots, layersOpen, collapsed, floorsOpen, art, split, valuableLoot }) => ({
				filters,
				slots,
				layersOpen,
				collapsed,
				floorsOpen,
				art,
				split,
				valuableLoot,
			}),
			merge: (persisted, current) => {
				const saved = isRecord(persisted) ? persisted : {};
				const flag = (key: "layersOpen" | "floorsOpen" | "split" | "valuableLoot") =>
					typeof saved[key] === "boolean" ? (saved[key] as boolean) : current[key];
				return {
					...current,
					filters: isRecord(saved.filters) ? (saved.filters as Filters) : null,
					slots: Array.isArray(saved.slots)
						? saved.slots.slice(0, PRESET_SLOTS).map((slot) => (isRecord(slot) ? (slot as Filters) : null))
						: [],
					collapsed: isRecord(saved.collapsed) ? (saved.collapsed as Record<string, boolean>) : {},
					art: saved.art === "tiles" ? "tiles" : "svg",
					layersOpen: flag("layersOpen"),
					floorsOpen: flag("floorsOpen"),
					split: flag("split"),
					valuableLoot: flag("valuableLoot"),
				};
			},
		},
	),
);
