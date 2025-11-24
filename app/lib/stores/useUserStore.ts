import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Station } from "@/app/types";

interface UserState {
    // Per-station progress and visibility
    stationLevels: Record<string, number>; // stationId -> current level
    hiddenStations: Record<string, boolean>; // stationId -> hidden?

    // Checklist view options
    checklistViewMode: "all" | "nextLevel";
    showHidden: boolean; // include hidden stations in pooled items
    hideCheap: boolean; // filter out cheap items
    cheapPriceThreshold: number; // e.g. in roubles

    // Hideout View options
    compactMode: boolean;

    // Actions
    setStationLevel: (stationId: string, level: number) => void;
    incrementStationLevel: (stationId: string) => void;
    toggleHiddenStation: (stationId: string) => void;

    setChecklistViewMode: (mode: "all" | "nextLevel") => void;
    setShowHidden: (value: boolean) => void;
    setHideCheap: (value: boolean) => void;
    setCheapPriceThreshold: (value: number) => void;
    setCompactMode: (value: boolean) => void;

    // Initialization helpers
    initializeDefaults: (stations: Station[]) => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            stationLevels: {},
            hiddenStations: {},
            checklistViewMode: "nextLevel",
            showHidden: false,
            hideCheap: false,
            cheapPriceThreshold: 5000,
            compactMode: false,

            setStationLevel: (stationId, level) =>
                set((state) => ({ stationLevels: { ...state.stationLevels, [stationId]: level } })),

            incrementStationLevel: (stationId) =>
                set((state) => {
                    const current = state.stationLevels[stationId] ?? 0;
                    return { stationLevels: { ...state.stationLevels, [stationId]: current + 1 } };
                }),

            toggleHiddenStation: (stationId) =>
                set((state) => ({
                    hiddenStations: {
                        ...state.hiddenStations,
                        [stationId]: !state.hiddenStations[stationId],
                    },
                })),

            setChecklistViewMode: (mode) => set({ checklistViewMode: mode }),
            setShowHidden: (value) => set({ showHidden: value }),
            setHideCheap: (value) => set({ hideCheap: value }),
            setCheapPriceThreshold: (value) => set({ cheapPriceThreshold: value }),
            setCompactMode: (value) => set({ compactMode: value }),

            initializeDefaults: (stations) => {
                const { stationLevels } = get();
                const newLevels = { ...stationLevels };
                let changed = false;

                stations.forEach((s) => {
                    if (newLevels[s.id] === undefined) {
                        newLevels[s.id] = 0;
                        changed = true;
                    }
                });

                if (changed) {
                    set({ stationLevels: newLevels });
                }
            },
        }),
        {
            name: "tarkov-hideout-user-state",
            version: 1,
        }
    )
);
