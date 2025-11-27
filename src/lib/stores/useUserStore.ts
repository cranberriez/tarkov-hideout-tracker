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
export type ItemSize = "Icon" | "Compact" | "Expanded";

interface UserState {
    // Per-station progress and visibility
    stationLevels: Record<string, number>; // stationId -> current level
    hiddenStations: Record<string, boolean>; // stationId -> hidden?
    completedRequirements: Record<string, boolean>; // requirementId -> completed?

    // Per-item ownership counts
    itemCounts: Record<string, { have: number; haveFir: number }>; // itemId -> counts

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
    itemsSize: ItemSize;

    // Onboarding / feature flags
    hasSeenItemConversionModal: boolean;

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

    addItemCounts: (itemId: string, haveDelta: number, haveFirDelta: number) => void;

    setChecklistViewMode: (mode: "all" | "nextLevel") => void;
    setShowHidden: (value: boolean) => void;
    setHideCheap: (value: boolean) => void;
    setHideMoney: (value: boolean) => void;
    setShowFirOnly: (value: boolean) => void;
    setHideRequirements: (value: boolean) => void;
    setCheapPriceThreshold: (value: number) => void;
    setHideoutCompactMode: (value: boolean) => void;
    setItemsSize: (value: ItemSize) => void;

    setSellToPreference: (value: "best" | "flea" | "trader") => void;
    setUseCategorization: (value: boolean) => void;

    setHasSeenItemConversionModal: (value: boolean) => void;

    setGameEdition: (edition: GameEdition) => void;
    setGameMode: (mode: GameMode) => void;
    completeSetup: () => void;
    setSetupOpen: (isOpen: boolean) => void;
    applyEditionBonuses: (stations: Station[]) => void;

    importStationLevels: (levels: Record<string, number>) => void;
    resetAll: () => void;

    // Initialization helpers
    initializeDefaults: (stations: Station[]) => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            stationLevels: {},
            hiddenStations: {},
            completedRequirements: {},
            itemCounts: {},
            checklistViewMode: "all",
            showHidden: false,
            hideCheap: false,
            hideMoney: false,
            showFirOnly: false,
            hideRequirements: false,
            cheapPriceThreshold: 5000,
            hideoutCompactMode: false,
            itemsSize: "Expanded",
            hasSeenItemConversionModal: false,
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

            toggleRequirement: (requirementId) => {
                set((state) => {
                    return {
                        completedRequirements: {
                            ...state.completedRequirements,
                            [requirementId]: !state.completedRequirements[requirementId],
                        },
                    };
                });
            },

            addItemCounts: (itemId, haveDelta, haveFirDelta) => {
                set((state) => {
                    const current = state.itemCounts[itemId] ?? { have: 0, haveFir: 0 };
                    return {
                        itemCounts: {
                            ...state.itemCounts,
                            [itemId]: {
                                have: current.have + haveDelta,
                                haveFir: current.haveFir + haveFirDelta,
                            },
                        },
                    };
                });
            },

            setChecklistViewMode: (mode) => set({ checklistViewMode: mode }),
            setShowHidden: (value) => set({ showHidden: value }),
            setHideCheap: (value) => set({ hideCheap: value }),
            setHideMoney: (value) => set({ hideMoney: value }),
            setShowFirOnly: (value) => set({ showFirOnly: value }),
            setHideRequirements: (value) => set({ hideRequirements: value }),
            setCheapPriceThreshold: (value) => set({ cheapPriceThreshold: value }),
            setHideoutCompactMode: (value) => set({ hideoutCompactMode: value }),
            setItemsSize: (value) => set({ itemsSize: value }),
            setSellToPreference: (value) => set({ sellToPreference: value }),
            setUseCategorization: (value) => set({ useCategorization: value }),

            setHasSeenItemConversionModal: (value) => set({ hasSeenItemConversionModal: value }),

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

            importStationLevels: (levels) => {
                set({ stationLevels: levels });
            },

            resetAll: () => {
                set(() => ({
                    stationLevels: {},
                    hiddenStations: {},
                    completedRequirements: {},
                    itemCounts: {},
                    checklistViewMode: "all",
                    showHidden: false,
                    hideCheap: false,
                    hideMoney: false,
                    showFirOnly: false,
                    hideRequirements: false,
                    cheapPriceThreshold: 5000,
                    hideoutCompactMode: false,
                    itemsSize: "Expanded",
                    hasSeenItemConversionModal: false,
                    sellToPreference: "best",
                    useCategorization: false,
                    gameEdition: null,
                    gameMode: "PVP",
                    hasCompletedSetup: false,
                    isSetupOpen: false,
                }));
            },
        }),
        {
            name: "tarkov-hideout-user-state",
            version: 2,
            migrate: (persistedState, version) => {
                if (version < 2) {
                    const state = persistedState as any;
                    const itemsCompactMode: boolean | undefined = state.itemsCompactMode;

                    return {
                        ...state,
                        itemsSize: itemsCompactMode ? "Compact" : "Expanded",
                    };
                }

                return persistedState as any;
            },
        }
    )
);
