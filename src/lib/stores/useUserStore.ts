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
export type ItemSourceFilter = "all" | "hideout" | "quest";

type StationEditionTarget = Pick<Station, "id" | "normalizedName">;

interface UserState {
    // Per-station progress and visibility
    stationLevels: Record<string, number>; // stationId -> current level
    hiddenStations: Record<string, boolean>; // stationId -> hidden?
    completedRequirements: Record<string, boolean>; // requirementId -> completed?
    completedQuests: Record<string, boolean>; // questId -> completed?
    questsWithItems: Record<string, boolean>; // questId -> items collected but not handed in
    ignoredQuests: Record<string, boolean>; // questId -> hidden from quest demand
    pinnedQuests: Record<string, boolean>; // questId -> manually prioritized

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

    itemSourceFilter: ItemSourceFilter;

    sellToPreference: "best" | "flea" | "trader";
    useCategorization: boolean;

    // View options
    hideoutCompactMode: boolean;
    itemsSize: ItemSize;

    // Quest tracking
    playerLevel: number;
    prestigeLevel: number;
    questTraderLoyaltyLevels: Record<string, number>;

    // Quest page filter preferences (persisted)
    questViewMode: "list" | "byTrader" | "tree";
    questSelectedTraders: string[];
    questFaction: "USEC" | "BEAR" | null;
    questShowKappa: boolean;
    questShowLightkeeper: boolean;
    questSelectedMaps: string[];
    questHideCompleted: boolean;
    questShowAvailableOnly: boolean;
    questShowHandInOnly: boolean;
    questShowFirHandInOnly: boolean;
    questShowPinnedOnly: boolean;
    questShowIgnored: boolean;
    questShowDebug: boolean;
    questShowPrereqs: boolean;
    questSidebarCollapsed: boolean;

    itemShowPinnedQuestSection: boolean;
    itemShowPinnedQuestOnly: boolean;
    itemQuestMaxDepth: number;

    // Onboarding / feature flags
    hasSeenItemConversionModal: boolean;
    hasSeenHideoutLevelWarning: boolean;

    // Setup / Game Settings
    gameEdition: GameEdition | null;
    gameMode: GameMode;
    hasCompletedSetup: boolean;
    isSetupOpen: boolean;

    editionBonusesAppliedFor: GameEdition | null;

    // Actions
    setStationLevel: (stationId: string, level: number) => void;
    incrementStationLevel: (stationId: string) => void;
    toggleHiddenStation: (stationId: string) => void;
    toggleRequirement: (requirementId: string) => void;
    toggleQuestCompletion: (questId: string) => void;
    toggleQuestHaveItems: (questId: string) => void;
    toggleIgnoredQuest: (questId: string) => void;
    togglePinnedQuest: (questId: string) => void;

    addItemCounts: (itemId: string, haveDelta: number, haveFirDelta: number) => void;

    setChecklistViewMode: (mode: "all" | "nextLevel") => void;
    setItemSourceFilter: (value: ItemSourceFilter) => void;
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
    setHasSeenHideoutLevelWarning: (value: boolean) => void;

    setGameEdition: (edition: GameEdition) => void;
    setGameMode: (mode: GameMode) => void;
    completeSetup: () => void;
    setSetupOpen: (isOpen: boolean) => void;
    setPlayerLevel: (level: number) => void;
    setPrestigeLevel: (level: number) => void;
    setQuestTraderLoyaltyLevel: (traderId: string, level: number) => void;

    setQuestViewMode: (mode: "list" | "byTrader" | "tree") => void;
    setQuestSelectedTraders: (ids: string[]) => void;
    setQuestFaction: (f: "USEC" | "BEAR" | null) => void;
    setQuestShowKappa: (v: boolean) => void;
    setQuestShowLightkeeper: (v: boolean) => void;
    setQuestSelectedMaps: (maps: string[]) => void;
    setQuestHideCompleted: (v: boolean) => void;
    setQuestShowAvailableOnly: (v: boolean) => void;
    setQuestShowHandInOnly: (v: boolean) => void;
    setQuestShowFirHandInOnly: (v: boolean) => void;
    setQuestShowPinnedOnly: (v: boolean) => void;
    setQuestShowIgnored: (v: boolean) => void;
    setQuestShowDebug: (v: boolean) => void;
    setQuestShowPrereqs: (v: boolean) => void;
    setQuestSidebarCollapsed: (v: boolean) => void;

    setItemShowPinnedQuestSection: (v: boolean) => void;
    setItemShowPinnedQuestOnly: (v: boolean) => void;
    setItemQuestMaxDepth: (v: number) => void;

    applyEditionBonuses: (stations: StationEditionTarget[]) => void;

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
            completedQuests: {},
            questsWithItems: {},
            ignoredQuests: {},
            pinnedQuests: {},
            itemCounts: {},
            checklistViewMode: "all",
            itemSourceFilter: "all",
            showHidden: false,
            hideCheap: false,
            hideMoney: false,
            showFirOnly: false,
            hideRequirements: false,
            cheapPriceThreshold: 5000,
            hideoutCompactMode: false,
            itemsSize: "Expanded",
            hasSeenItemConversionModal: false,
            hasSeenHideoutLevelWarning: false,
            sellToPreference: "best",
            useCategorization: false,

            playerLevel: 1,
            prestigeLevel: 0,
            questTraderLoyaltyLevels: {},

            questViewMode: "tree",
            questSelectedTraders: [],
            questFaction: null,
            questShowKappa: false,
            questShowLightkeeper: false,
            questSelectedMaps: [],
            questHideCompleted: false,
            questShowAvailableOnly: false,
            questShowHandInOnly: false,
            questShowFirHandInOnly: false,
            questShowPinnedOnly: false,
            questShowIgnored: false,
            questShowDebug: false,
            questShowPrereqs: true,
            questSidebarCollapsed: false,

            itemShowPinnedQuestSection: true,
            itemShowPinnedQuestOnly: false,
            itemQuestMaxDepth: 1,

            gameEdition: null,
            gameMode: "PVP",
            hasCompletedSetup: false,
            isSetupOpen: false,

            editionBonusesAppliedFor: null,

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

            toggleQuestCompletion: (questId) =>
                set((state) => {
                    const willComplete = !state.completedQuests[questId];
                    return {
                        completedQuests: { ...state.completedQuests, [questId]: willComplete },
                        // clear "have items" when marking a quest complete
                        ...(willComplete
                            ? { questsWithItems: { ...state.questsWithItems, [questId]: false } }
                            : {}),
                    };
                }),

            toggleQuestHaveItems: (questId) =>
                set((state) => ({
                    questsWithItems: {
                        ...state.questsWithItems,
                        [questId]: !state.questsWithItems[questId],
                    },
                })),

            toggleIgnoredQuest: (questId) =>
                set((state) => ({
                    ignoredQuests: {
                        ...state.ignoredQuests,
                        [questId]: !state.ignoredQuests[questId],
                    },
                })),

            togglePinnedQuest: (questId) =>
                set((state) => ({
                    pinnedQuests: {
                        ...state.pinnedQuests,
                        [questId]: !state.pinnedQuests[questId],
                    },
                })),

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
            setItemSourceFilter: (value) => set({ itemSourceFilter: value }),
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

            setPlayerLevel: (level) => set({ playerLevel: level }),
            setPrestigeLevel: (level) => set({ prestigeLevel: level }),
            setQuestTraderLoyaltyLevel: (traderId, level) =>
                set((state) => ({
                    questTraderLoyaltyLevels: {
                        ...state.questTraderLoyaltyLevels,
                        [traderId]: level,
                    },
                })),

            setQuestViewMode: (mode) => set({ questViewMode: mode }),
            setQuestSelectedTraders: (ids) => set({ questSelectedTraders: ids }),
            setQuestFaction: (f) => set({ questFaction: f }),
            setQuestShowKappa: (v) => set({ questShowKappa: v }),
            setQuestShowLightkeeper: (v) => set({ questShowLightkeeper: v }),
            setQuestSelectedMaps: (maps) => set({ questSelectedMaps: maps }),
            setQuestHideCompleted: (v) => set({ questHideCompleted: v }),
            setQuestShowAvailableOnly: (v) => set({ questShowAvailableOnly: v }),
            setQuestShowHandInOnly: (v) =>
                set((state) => ({
                    questShowHandInOnly: v,
                    questShowFirHandInOnly: v ? state.questShowFirHandInOnly : false,
                })),
            setQuestShowFirHandInOnly: (v) =>
                set((state) => ({
                    questShowFirHandInOnly: state.questShowHandInOnly ? v : false,
                })),
            setQuestShowPinnedOnly: (v) => set({ questShowPinnedOnly: v }),
            setQuestShowIgnored: (v) => set({ questShowIgnored: v }),
            setQuestShowDebug: (v) => set({ questShowDebug: v }),
            setQuestShowPrereqs: (v) => set({ questShowPrereqs: v }),
            setQuestSidebarCollapsed: (v) => set({ questSidebarCollapsed: v }),

            setItemShowPinnedQuestSection: (v) =>
                set((state) => ({
                    itemShowPinnedQuestSection: v,
                    itemShowPinnedQuestOnly: v ? state.itemShowPinnedQuestOnly : false,
                })),
            setItemShowPinnedQuestOnly: (v) =>
                set((state) => ({
                    itemShowPinnedQuestOnly: v,
                    itemShowPinnedQuestSection: v ? true : state.itemShowPinnedQuestSection,
                })),
            setItemQuestMaxDepth: (v) =>
                set({
                    itemQuestMaxDepth: Number.isFinite(v) ? Math.max(1, Math.floor(v)) : 1,
                }),

            setHasSeenItemConversionModal: (value) => set({ hasSeenItemConversionModal: value }),
            setHasSeenHideoutLevelWarning: (value) => set({ hasSeenHideoutLevelWarning: value }),

            setGameEdition: (edition) => set({ gameEdition: edition }),
            setGameMode: (mode) => set({ gameMode: mode }),
            completeSetup: () => set({ hasCompletedSetup: true, isSetupOpen: false }),
            setSetupOpen: (isOpen) => set({ isSetupOpen: isOpen }),

            applyEditionBonuses: (stations) => {
                const { gameEdition, stationLevels, editionBonusesAppliedFor } = get();
                if (!gameEdition) return;

                if (editionBonusesAppliedFor === gameEdition) return;

                const newLevels = { ...stationLevels };
                let stashLevel = 1;

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

                set({ stationLevels: newLevels, editionBonusesAppliedFor: gameEdition });
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
                    completedQuests: {},
                    questsWithItems: {},
                    ignoredQuests: {},
                    pinnedQuests: {},
                    itemCounts: {},
                    checklistViewMode: "all",
                    itemSourceFilter: "all",
                    showHidden: false,
                    hideCheap: false,
                    hideMoney: false,
                    showFirOnly: false,
                    hideRequirements: false,
                    cheapPriceThreshold: 5000,
                    hideoutCompactMode: false,
                    itemsSize: "Expanded",
                    hasSeenItemConversionModal: false,
                    hasSeenHideoutLevelWarning: false,
                    sellToPreference: "best",
                    useCategorization: false,
                    playerLevel: 1,
                    prestigeLevel: 0,
                    questTraderLoyaltyLevels: {},
                    questViewMode: "tree",
                    questSelectedTraders: [],
                    questFaction: null,
                    questShowKappa: false,
                    questShowLightkeeper: false,
                    questSelectedMaps: [],
                    questHideCompleted: false,
                    questShowAvailableOnly: false,
                    questShowHandInOnly: false,
                    questShowFirHandInOnly: false,
                    questShowPinnedOnly: false,
                    questShowIgnored: false,
                    questShowDebug: false,
                    questShowPrereqs: true,
                    questSidebarCollapsed: false,
                    itemShowPinnedQuestSection: true,
                    itemShowPinnedQuestOnly: false,
                    itemQuestMaxDepth: 1,
                    gameEdition: null,
                    gameMode: "PVP",
                    hasCompletedSetup: false,
                    isSetupOpen: false,
                    editionBonusesAppliedFor: null,
                }));
            },
        }),
        {
            name: "tarkov-hideout-user-state",
            version: 7,
            migrate: (persistedState, version) => {
                let nextState =
                    persistedState && typeof persistedState === "object"
                        ? ({ ...persistedState } as Record<string, unknown>)
                        : {};

                if (version < 2) {
                    const itemsCompactMode =
                        typeof nextState.itemsCompactMode === "boolean"
                            ? nextState.itemsCompactMode
                            : undefined;

                    nextState = {
                        ...nextState,
                        itemsSize: itemsCompactMode ? "Compact" : "Expanded",
                    };
                }

                if (version < 3) {
                    nextState = {
                        ...nextState,
                        questViewMode: "tree",
                        questShowDebug: false,
                    };
                }

                if (version < 4) {
                    nextState = {
                        ...nextState,
                        ignoredQuests: {},
                        pinnedQuests: {},
                        questShowHandInOnly: false,
                        questShowFirHandInOnly: false,
                        questShowPinnedOnly: false,
                        questShowIgnored: false,
                        itemShowPinnedQuestSection: true,
                        itemShowPinnedQuestOnly: false,
                    };
                }

                if (version < 5) {
                    nextState = {
                        ...nextState,
                        questTraderLoyaltyLevels: {},
                    };
                }

                if (version < 6) {
                    nextState = {
                        ...nextState,
                        questSidebarCollapsed: false,
                    };
                }

                if (version < 7) {
                    nextState = {
                        ...nextState,
                        itemQuestMaxDepth: 1,
                    };
                }

                return nextState as unknown as UserState;
            },
        },
    ),
);
