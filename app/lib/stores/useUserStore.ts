import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Station } from "@/app/types";

interface UserState {
    // Per-station progress and visibility
    stationLevels: Record<string, number>; // stationId -> current level
    hiddenStations: Record<string, boolean>; // stationId -> hidden?
    completedRequirements: Record<string, boolean>; // requirementId -> completed?

    // Checklist view options
    checklistViewMode: "all" | "nextLevel";
    showHidden: boolean; // include hidden stations in pooled items
    hideCheap: boolean; // filter out cheap items
    hideMoney: boolean; // filter out currency items
    showFirOnly: boolean; // filter to show only Found In Raid items
    hideRequirements: boolean; // hide the requirements section entirely
    cheapPriceThreshold: number; // e.g. in roubles

    sellToPreference: "best" | "flea" | "trader";
    useCategorization: boolean;

    // Hideout View options
    compactMode: boolean;

    // Actions
    setStationLevel: (stationId: string, level: number) => void;
    incrementStationLevel: (stationId: string) => void;
    toggleHiddenStation: (stationId: string) => void;
    toggleRequirement: (requirementId: string) => void;

    setChecklistViewMode: (mode: "all" | "nextLevel") => void;
    setShowHidden: (value: boolean) => void;
    setHideCheap: (value: boolean) => void;
    setHideMoney: (value: boolean) => void;
    setShowFirOnly: (value: boolean) => void;
    setHideRequirements: (value: boolean) => void;
    setCheapPriceThreshold: (value: number) => void;
    setCompactMode: (value: boolean) => void;

    setSellToPreference: (value: "best" | "flea" | "trader") => void;
    setUseCategorization: (value: boolean) => void;

    // Initialization helpers
    initializeDefaults: (stations: Station[]) => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            stationLevels: {},
            hiddenStations: {},
            completedRequirements: {},
            checklistViewMode: "nextLevel",
            showHidden: false,
            hideCheap: false,
            hideMoney: false,
            showFirOnly: false,
            hideRequirements: false,
            cheapPriceThreshold: 5000,
            compactMode: false,
            sellToPreference: "best",
            useCategorization: false,

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

            toggleRequirement: (requirementId) =>
                set((state) => ({
                    completedRequirements: {
                        ...state.completedRequirements,
                        [requirementId]: !state.completedRequirements[requirementId],
                    },
                })),

            setChecklistViewMode: (mode) => set({ checklistViewMode: mode }),
            setShowHidden: (value) => set({ showHidden: value }),
            setHideCheap: (value) => set({ hideCheap: value }),
            setHideMoney: (value) => set({ hideMoney: value }),
            setShowFirOnly: (value) => set({ showFirOnly: value }),
            setHideRequirements: (value) => set({ hideRequirements: value }),
            setCheapPriceThreshold: (value) => set({ cheapPriceThreshold: value }),
            setCompactMode: (value) => set({ compactMode: value }),
            setSellToPreference: (value) => set({ sellToPreference: value }),
            setUseCategorization: (value) => set({ useCategorization: value }),

            initializeDefaults: (stations) => {
                const { stationLevels } = get();
                const newLevels = { ...stationLevels };
                let changed = false;

                stations.forEach((s) => {
                    if (newLevels[s.id] === undefined) {
                        newLevels[s.id] = s.normalizedName === "stash" ? 1 : 0;
                        changed = true;
                    } else if (s.normalizedName === "stash" && newLevels[s.id] < 1) {
                        newLevels[s.id] = 1;
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
