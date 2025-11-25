import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Station } from "@/types";

export type GameEdition =
    | "Standard"
    | "Left Behind"
    | "Prepare for Escape"
    | "Edge of Darkness"
    | "Unheard";
export type GameMode = "PVP" | "PVE";

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

    // View options
    hideoutCompactMode: boolean;
    itemsCompactMode: boolean;

    // Setup / Game Settings
    gameEdition: GameEdition | null;
    gameMode: GameMode;
    hasCompletedSetup: boolean;
    isSetupOpen: boolean;

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
    setHideoutCompactMode: (value: boolean) => void;
    setItemsCompactMode: (value: boolean) => void;

    setSellToPreference: (value: "best" | "flea" | "trader") => void;
    setUseCategorization: (value: boolean) => void;

    setGameEdition: (edition: GameEdition) => void;
    setGameMode: (mode: GameMode) => void;
    completeSetup: () => void;
    setSetupOpen: (isOpen: boolean) => void;
    applyEditionBonuses: (stations: Station[]) => void;

    // Initialization helpers
    initializeDefaults: (stations: Station[]) => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            stationLevels: {},
            hiddenStations: {},
            completedRequirements: {},
            checklistViewMode: "all",
            showHidden: false,
            hideCheap: false,
            hideMoney: false,
            showFirOnly: false,
            hideRequirements: false,
            cheapPriceThreshold: 5000,
            hideoutCompactMode: false,
            itemsCompactMode: false,
            sellToPreference: "best",
            useCategorization: false,

            gameEdition: null,
            gameMode: "PVP",
            hasCompletedSetup: false,
            isSetupOpen: false,

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
            setHideoutCompactMode: (value) => set({ hideoutCompactMode: value }),
            setItemsCompactMode: (value) => set({ itemsCompactMode: value }),
            setSellToPreference: (value) => set({ sellToPreference: value }),
            setUseCategorization: (value) => set({ useCategorization: value }),

            setGameEdition: (edition) => set({ gameEdition: edition }),
            setGameMode: (mode) => set({ gameMode: mode }),
            completeSetup: () => set({ hasCompletedSetup: true, isSetupOpen: false }),
            setSetupOpen: (isOpen) => set({ isSetupOpen: isOpen }),

            applyEditionBonuses: (stations) => {
                const { gameEdition, stationLevels } = get();
                if (!gameEdition) return;

                const newLevels = { ...stationLevels };
                let stashLevel = 1;
                let cultistLevel = 0;

                switch (gameEdition) {
                    case "Standard":
                        stashLevel = 1;
                        break;
                    case "Left Behind":
                        stashLevel = 2;
                        break;
                    case "Prepare for Escape":
                        stashLevel = 3;
                        break;
                    case "Edge of Darkness":
                        stashLevel = 4;
                        break;
                    case "Unheard":
                        stashLevel = 4;
                        cultistLevel = 1;
                        break;
                }

                stations.forEach((s) => {
                    if (s.normalizedName === "stash") {
                        newLevels[s.id] = stashLevel;
                    }
                    if (s.normalizedName === "cultist-circle" && gameEdition === "Unheard") {
                        if ((newLevels[s.id] || 0) < 1) {
                            newLevels[s.id] = 1;
                        }
                    }
                });

                set({ stationLevels: newLevels });
            },

            initializeDefaults: (stations) => {
                const { stationLevels, gameEdition } = get();
                const newLevels = { ...stationLevels };
                let changed = false;

                let stashBase = 1;
                let cultistBase = 0;
                if (gameEdition) {
                    switch (gameEdition) {
                        case "Standard":
                            stashBase = 1;
                            break;
                        case "Left Behind":
                            stashBase = 2;
                            break;
                        case "Prepare for Escape":
                            stashBase = 3;
                            break;
                        case "Edge of Darkness":
                            stashBase = 4;
                            break;
                        case "Unheard":
                            stashBase = 4;
                            cultistBase = 1;
                            break;
                    }
                }

                stations.forEach((s) => {
                    if (newLevels[s.id] === undefined) {
                        newLevels[s.id] = 0;
                        changed = true;
                    }

                    if (s.normalizedName === "stash") {
                        if ((newLevels[s.id] || 0) < stashBase) {
                            newLevels[s.id] = stashBase;
                            changed = true;
                        }
                    }

                    if (s.normalizedName === "cultist-circle") {
                        if ((newLevels[s.id] || 0) < cultistBase) {
                            newLevels[s.id] = cultistBase;
                            changed = true;
                        }
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
