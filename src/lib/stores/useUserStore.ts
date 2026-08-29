import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_IGNORED_QUESTS } from "../cfg/defaultIgnoredQuests";
import { GAME_MODES, toTarkovJsonGameMode, type GameMode } from "../game-mode";
import type { Station } from "../../types";

export { GAME_MODES, toTarkovJsonGameMode };
export type { GameMode };

export const USER_STORE_STORAGE_KEY = "tarkov-hideout-user-state";

export type GameEdition =
    | "Standard"
    | "Left Behind"
    | "Prepare for Escape"
    | "Edge of Darkness"
    | "Unheard";
export type ItemSize = "Icon" | "Compact" | "Expanded";
export type ItemSourceFilter = "all" | "hideout" | "quest";
export type ItemQuestVisibilityMode = "available" | "nextLayer" | "allFuture" | "custom";
export type QuestViewMode = "byMap" | "byTrader" | "flatList";
export type QuestCardSize = "small" | "large";
export type QuestSortMode = "unlockOrder" | "default" | "level" | "xp" | "unlockImpact";
export type QuestVisibilityMode = "all" | "hideLocked" | "activeDepth";
export type QuestWorkspaceStatus = "active" | "completed" | "failed" | "locked";
export interface QuestWorkspaceLockedFilterSettings {
    showAll: boolean;
    showPlayerLevel: boolean;
    playerLevelUpcomingOnly: boolean;
    playerLevelLookahead: number;
    showTaskCount: boolean;
    taskCountUpcomingOnly: boolean;
    showPrerequisite: boolean;
    prerequisiteUpcomingOnly: boolean;
    prerequisiteLookahead: number;
    showFaction: boolean;
}
export type QuestObjectiveCategory =
    | "hand-in"
    | "find"
    | "plant"
    | "eliminate"
    | "extract"
    | "location"
    | "build"
    | "use"
    | "other";
export type QuestChangeType = "completed" | "uncompleted";

export const DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS: QuestWorkspaceLockedFilterSettings = {
    showAll: false,
    showPlayerLevel: false,
    playerLevelUpcomingOnly: true,
    playerLevelLookahead: 5,
    showTaskCount: true,
    taskCountUpcomingOnly: true,
    showPrerequisite: true,
    prerequisiteUpcomingOnly: true,
    prerequisiteLookahead: 1,
    showFaction: false,
};

export interface QuestChangeHistoryEntry {
    questId: string;
    timestamp: number;
    change: QuestChangeType;
}

function mergeQuestChangeHistory(
    history: QuestChangeHistoryEntry[],
    entries: QuestChangeHistoryEntry[],
) {
    return entries.reduce(
        (current, entry) => [
            ...current.filter(
                (existing) =>
                    existing.questId !== entry.questId || existing.change !== entry.change,
            ),
            entry,
        ],
        [...history],
    );
}

function normalizeQuestChangeHistory(value: unknown): QuestChangeHistoryEntry[] {
    if (!Array.isArray(value)) return [];
    const validEntries = value.filter(
        (entry): entry is QuestChangeHistoryEntry =>
            typeof entry === "object" &&
            entry !== null &&
            typeof entry.questId === "string" &&
            typeof entry.timestamp === "number" &&
            (entry.change === "completed" || entry.change === "uncompleted"),
    );
    return mergeQuestChangeHistory([], validEntries);
}

type StationEditionTarget = Pick<Station, "id" | "normalizedName">;

export interface PlayerProfileState {
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
    completedRequirements: Record<string, boolean>;
    completedQuests: Record<string, boolean>;
    failedQuests: Record<string, boolean>;
    questsWithItems: Record<string, boolean>;
    ignoredQuests: Record<string, boolean>;
    pinnedQuests: Record<string, boolean>;
    questChangeHistory: QuestChangeHistoryEntry[];
    itemCounts: Record<string, { have: number; haveFir: number }>;
    playerLevel: number;
    prestigeLevel: number;
    questTraderLoyaltyLevels: Record<string, number>;
    questFenceReputation: number;
    questFaction: "USEC" | "BEAR" | null;
    questShowKappa: boolean;
    questShowLightkeeper: boolean;
    gameEdition: GameEdition | null;
    editionBonusesAppliedFor: GameEdition | null;
    hasCompletedSetup: boolean;
}

function createDefaultPlayerProfile(): PlayerProfileState {
    return {
        stationLevels: {},
        hiddenStations: {},
        completedRequirements: {},
        completedQuests: {},
        failedQuests: {},
        questsWithItems: {},
        ignoredQuests: { ...DEFAULT_IGNORED_QUESTS },
        pinnedQuests: {},
        questChangeHistory: [],
        itemCounts: {},
        playerLevel: 1,
        prestigeLevel: 0,
        questTraderLoyaltyLevels: {},
        questFenceReputation: 0,
        questFaction: "USEC",
        questShowKappa: false,
        questShowLightkeeper: false,
        gameEdition: null,
        editionBonusesAppliedFor: null,
        hasCompletedSetup: false,
    };
}

function createDefaultProfiles(): Record<GameMode, PlayerProfileState> {
    return {
        PVP: createDefaultPlayerProfile(),
        PVE: createDefaultPlayerProfile(),
        KORD: createDefaultPlayerProfile(),
    };
}

const PLAYER_PROFILE_KEYS = Object.keys(createDefaultPlayerProfile()) as Array<
    keyof PlayerProfileState
>;

interface UserState {
    profiles: Record<GameMode, PlayerProfileState>;
    deprecatedLegacyState: Record<string, unknown> | null;
    hasConvertedDeprecatedLegacyState: boolean;
    hasDismissedDeprecatedLegacyState: boolean;
    // Per-station progress and visibility
    stationLevels: Record<string, number>; // stationId -> current level
    hiddenStations: Record<string, boolean>; // stationId -> hidden?
    completedRequirements: Record<string, boolean>; // requirementId -> completed?
    completedQuests: Record<string, boolean>; // questId -> completed?
    failedQuests: Record<string, boolean>; // questId -> failed?
    questsWithItems: Record<string, boolean>; // questId -> items collected but not handed in
    ignoredQuests: Record<string, boolean>; // questId -> hidden from quest demand
    pinnedQuests: Record<string, boolean>; // questId -> manually prioritized
    questChangeHistory: QuestChangeHistoryEntry[];

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
    itemFiltersOpen: boolean;

    sellToPreference: "best" | "flea" | "trader";
    useCategorization: boolean;

    // View options
    hideoutCompactMode: boolean;
    itemsSize: ItemSize;

    // Quest tracking
    playerLevel: number;
    prestigeLevel: number;
    questTraderLoyaltyLevels: Record<string, number>;
    questFenceReputation: number;

    // Quest page filter preferences (persisted)
    questViewMode: QuestViewMode;
    questCardSize: QuestCardSize;
    questSortMode: QuestSortMode;
    questSelectedTraders: string[];
    questFaction: "USEC" | "BEAR" | null;
    questShowKappa: boolean;
    questShowLightkeeper: boolean;
    questSelectedMaps: string[];
    questHideCompleted: boolean;
    questShowAvailableOnly: boolean;
    questVisibilityMode: QuestVisibilityMode;
    questActiveDepth: number;
    questShowHandInOnly: boolean;
    questShowFirHandInOnly: boolean;
    questShowPinnedOnly: boolean;
    questShowIgnored: boolean;
    questShowDebug: boolean;
    questShowPrereqs: boolean;
    questSidebarCollapsed: boolean;

    // Profile-independent quest workspace filters (persisted)
    questWorkspaceSelectedTraders: string[];
    questWorkspaceFilterByTraderRequirements: boolean;
    questWorkspaceSelectedMaps: string[];
    questWorkspaceSelectedStatuses: QuestWorkspaceStatus[];
    questWorkspaceLockedFilters: QuestWorkspaceLockedFilterSettings;
    questWorkspaceSelectedObjectiveCategories: QuestObjectiveCategory[];

    itemShowPinnedQuestSection: boolean;
    itemShowPinnedQuestOnly: boolean;
    itemQuestMaxDepth: number;
    itemQuestVisibilityMode: ItemQuestVisibilityMode;
    itemQuestCustomLookahead: number;
    itemQuestCustomLevelLookahead: number;
    itemShowFutureFir: boolean;
    itemShowIgnored: boolean;

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
    applyQuestCompletionChange: (changes: {
        complete?: string[];
        uncomplete?: string[];
        fail?: string[];
        unFail?: string[];
    }) => void;
    applyQuestFailureChange: (changes: { fail?: string[]; unFail?: string[] }) => void;
    toggleQuestHaveItems: (questId: string) => void;
    toggleIgnoredQuest: (questId: string) => void;
    togglePinnedQuest: (questId: string) => void;

    addItemCounts: (itemId: string, haveDelta: number, haveFirDelta: number) => void;

    setChecklistViewMode: (mode: "all" | "nextLevel") => void;
    setItemSourceFilter: (value: ItemSourceFilter) => void;
    setItemFiltersOpen: (value: boolean) => void;
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
    setQuestFenceReputation: (reputation: number) => void;

    setQuestViewMode: (mode: QuestViewMode) => void;
    setQuestCardSize: (size: QuestCardSize) => void;
    setQuestSortMode: (mode: QuestSortMode) => void;
    setQuestSelectedTraders: (ids: string[]) => void;
    setQuestFaction: (f: "USEC" | "BEAR" | null) => void;
    setQuestShowKappa: (v: boolean) => void;
    setQuestShowLightkeeper: (v: boolean) => void;
    setQuestSelectedMaps: (maps: string[]) => void;
    setQuestHideCompleted: (v: boolean) => void;
    setQuestShowAvailableOnly: (v: boolean) => void;
    setQuestVisibilityMode: (v: QuestVisibilityMode) => void;
    setQuestActiveDepth: (v: number) => void;
    setQuestShowHandInOnly: (v: boolean) => void;
    setQuestShowFirHandInOnly: (v: boolean) => void;
    setQuestShowPinnedOnly: (v: boolean) => void;
    setQuestShowIgnored: (v: boolean) => void;
    setQuestShowDebug: (v: boolean) => void;
    setQuestShowPrereqs: (v: boolean) => void;
    setQuestSidebarCollapsed: (v: boolean) => void;
    setQuestWorkspaceSelectedTraders: (ids: string[]) => void;
    setQuestWorkspaceFilterByTraderRequirements: (enabled: boolean) => void;
    setQuestWorkspaceSelectedMaps: (mapKeys: string[]) => void;
    setQuestWorkspaceSelectedStatuses: (statuses: QuestWorkspaceStatus[]) => void;
    setQuestWorkspaceLockedFilters: (
        filters: Partial<QuestWorkspaceLockedFilterSettings>,
    ) => void;
    setQuestWorkspaceSelectedObjectiveCategories: (
        categories: QuestObjectiveCategory[],
    ) => void;

    setItemShowPinnedQuestSection: (v: boolean) => void;
    setItemShowPinnedQuestOnly: (v: boolean) => void;
    setItemQuestMaxDepth: (v: number) => void;
    setItemQuestVisibilityMode: (value: ItemQuestVisibilityMode) => void;
    setItemQuestCustomLookahead: (value: number) => void;
    setItemQuestCustomLevelLookahead: (value: number) => void;
    setItemShowFutureFir: (value: boolean) => void;
    setItemShowIgnored: (value: boolean) => void;

    applyEditionBonuses: (stations: StationEditionTarget[]) => void;

    importStationLevels: (levels: Record<string, number>) => void;
    resetHideoutData: () => void;
    resetItemData: () => void;
    resetQuestData: () => void;
    resetAll: () => void;
    applyProfilePatch: (patch: Partial<PlayerProfileState>) => void;
    convertDeprecatedLegacyState: (targetMode: GameMode) => void;
    dismissDeprecatedLegacyState: () => void;

    // Initialization helpers
    initializeDefaults: (stations: Station[]) => void;
}

function pickPlayerProfile(state: Partial<UserState>): Partial<PlayerProfileState> {
    const profile: Partial<PlayerProfileState> = {};
    for (const key of PLAYER_PROFILE_KEYS) {
        if (key in state) Object.assign(profile, { [key]: state[key] });
    }
    return profile;
}

function createPlayerProfileFromLegacyState(
    legacyState: Record<string, unknown>,
): PlayerProfileState {
    const legacyProfile = pickPlayerProfile(
        legacyState as unknown as Partial<UserState>,
    );
    const profile = {
        ...createDefaultPlayerProfile(),
        ...legacyProfile,
    } as PlayerProfileState;

    return {
        ...profile,
        stationLevels: { ...profile.stationLevels },
        hiddenStations: { ...profile.hiddenStations },
        completedRequirements: { ...profile.completedRequirements },
        completedQuests: { ...profile.completedQuests },
        failedQuests: { ...profile.failedQuests },
        questsWithItems: { ...profile.questsWithItems },
        ignoredQuests: { ...profile.ignoredQuests },
        pinnedQuests: { ...profile.pinnedQuests },
        questChangeHistory: normalizeQuestChangeHistory(profile.questChangeHistory),
        itemCounts: Object.fromEntries(
            Object.entries(profile.itemCounts).map(([itemId, counts]) => [
                itemId,
                { ...counts },
            ]),
        ),
        questTraderLoyaltyLevels: { ...profile.questTraderLoyaltyLevels },
    };
}

export const useUserStore = create<UserState>()(
    persist(
        (rawSet, get) => {
            const setWithProfileSync = (
                update: Partial<UserState> | ((state: UserState) => Partial<UserState>),
            ) =>
                rawSet((state) => {
                    const patch = typeof update === "function" ? update(state) : update;
                    const profilePatch = pickPlayerProfile(patch);
                    if (Object.keys(profilePatch).length === 0) return patch;
                    return {
                        ...patch,
                        profiles: {
                            ...state.profiles,
                            [state.gameMode]: {
                                ...state.profiles[state.gameMode],
                                ...profilePatch,
                            },
                        },
                    };
                });
            const set = setWithProfileSync;

            return ({
            profiles: createDefaultProfiles(),
            deprecatedLegacyState: null,
            hasConvertedDeprecatedLegacyState: false,
            hasDismissedDeprecatedLegacyState: false,
            stationLevels: {},
            hiddenStations: {},
            completedRequirements: {},
            completedQuests: {},
            failedQuests: {},
            questsWithItems: {},
            ignoredQuests: DEFAULT_IGNORED_QUESTS,
            pinnedQuests: {},
            questChangeHistory: [],
            itemCounts: {},
            checklistViewMode: "all",
            itemSourceFilter: "all",
            itemFiltersOpen: false,
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
            questFenceReputation: 0,

            questViewMode: "byTrader",
            questCardSize: "small",
            questSortMode: "unlockOrder",
            questSelectedTraders: [],
            questFaction: "USEC",
            questShowKappa: false,
            questShowLightkeeper: false,
            questSelectedMaps: [],
            questHideCompleted: false,
            questShowAvailableOnly: false,
            questVisibilityMode: "all",
            questActiveDepth: 2,
            questShowHandInOnly: false,
            questShowFirHandInOnly: false,
            questShowPinnedOnly: false,
            questShowIgnored: false,
            questShowDebug: false,
            questShowPrereqs: true,
            questSidebarCollapsed: false,
            questWorkspaceSelectedTraders: [],
            questWorkspaceFilterByTraderRequirements: true,
            questWorkspaceSelectedMaps: [],
            questWorkspaceSelectedStatuses: ["active", "completed", "failed", "locked"],
            questWorkspaceLockedFilters: { ...DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS },
            questWorkspaceSelectedObjectiveCategories: [],

            itemShowPinnedQuestSection: true,
            itemShowPinnedQuestOnly: false,
            itemQuestMaxDepth: 1,
            itemQuestVisibilityMode: "available",
            itemQuestCustomLookahead: 5,
            itemQuestCustomLevelLookahead: 5,
            itemShowFutureFir: false,
            itemShowIgnored: false,

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
                        questChangeHistory: mergeQuestChangeHistory(
                            state.questChangeHistory,
                            [{
                                questId,
                                timestamp: Date.now(),
                                change: willComplete ? "completed" : "uncompleted",
                            }],
                        ),
                        ...(willComplete
                            ? { failedQuests: { ...state.failedQuests, [questId]: false } }
                            : {}),
                        // clear "have items" when marking a quest complete
                        ...(willComplete
                            ? { questsWithItems: { ...state.questsWithItems, [questId]: false } }
                            : {}),
                    };
                }),

            applyQuestCompletionChange: ({ complete = [], uncomplete = [], fail = [], unFail = [] }) =>
                set((state) => {
                    if (
                        complete.length === 0 &&
                        uncomplete.length === 0 &&
                        fail.length === 0 &&
                        unFail.length === 0
                    ) {
                        return {};
                    }

                    const nextCompletedQuests = { ...state.completedQuests };
                    const nextFailedQuests = { ...state.failedQuests };
                    const nextQuestsWithItems = { ...state.questsWithItems };
                    const timestamp = Date.now();
                    const historyEntries: QuestChangeHistoryEntry[] = [];

                    for (const questId of complete) {
                        if (!nextCompletedQuests[questId]) {
                            historyEntries.push({ questId, timestamp, change: "completed" });
                        }
                        nextCompletedQuests[questId] = true;
                    }
                    for (const questId of uncomplete) {
                        if (nextCompletedQuests[questId]) {
                            historyEntries.push({ questId, timestamp, change: "uncompleted" });
                        }
                        nextCompletedQuests[questId] = false;
                    }
                    for (const questId of complete) nextFailedQuests[questId] = false;
                    for (const questId of fail) {
                        if (nextCompletedQuests[questId]) {
                            historyEntries.push({ questId, timestamp, change: "uncompleted" });
                        }
                        nextFailedQuests[questId] = true;
                        nextCompletedQuests[questId] = false;
                        nextQuestsWithItems[questId] = false;
                    }
                    for (const questId of unFail) nextFailedQuests[questId] = false;
                    for (const questId of complete) nextQuestsWithItems[questId] = false;

                    return {
                        completedQuests: nextCompletedQuests,
                        failedQuests: nextFailedQuests,
                        questsWithItems: nextQuestsWithItems,
                        questChangeHistory: mergeQuestChangeHistory(
                            state.questChangeHistory,
                            historyEntries,
                        ),
                    };
                }),

            applyQuestFailureChange: ({ fail = [], unFail = [] }) =>
                set((state) => {
                    if (fail.length === 0 && unFail.length === 0) return {};

                    const nextCompletedQuests = { ...state.completedQuests };
                    const nextFailedQuests = { ...state.failedQuests };
                    const nextQuestsWithItems = { ...state.questsWithItems };
                    const timestamp = Date.now();
                    const historyEntries: QuestChangeHistoryEntry[] = [];

                    for (const questId of fail) {
                        if (nextCompletedQuests[questId]) {
                            historyEntries.push({ questId, timestamp, change: "uncompleted" });
                        }
                        nextFailedQuests[questId] = true;
                        nextCompletedQuests[questId] = false;
                        nextQuestsWithItems[questId] = false;
                    }
                    for (const questId of unFail) nextFailedQuests[questId] = false;

                    return {
                        completedQuests: nextCompletedQuests,
                        failedQuests: nextFailedQuests,
                        questsWithItems: nextQuestsWithItems,
                        questChangeHistory: mergeQuestChangeHistory(
                            state.questChangeHistory,
                            historyEntries,
                        ),
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
            setItemFiltersOpen: (value) => set({ itemFiltersOpen: value }),
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
            setQuestFenceReputation: (reputation) =>
                set({ questFenceReputation: Number.isFinite(reputation) ? reputation : 0 }),

            setQuestViewMode: (mode) => set({ questViewMode: mode }),
            setQuestCardSize: (size) => set({ questCardSize: size }),
            setQuestSortMode: (mode) => set({ questSortMode: mode }),
            setQuestSelectedTraders: (ids) => set({ questSelectedTraders: ids }),
            setQuestFaction: (f) => set({ questFaction: f }),
            setQuestShowKappa: (v) => set({ questShowKappa: v }),
            setQuestShowLightkeeper: (v) => set({ questShowLightkeeper: v }),
            setQuestSelectedMaps: (maps) => set({ questSelectedMaps: maps }),
            setQuestHideCompleted: (v) => set({ questHideCompleted: v }),
            setQuestShowAvailableOnly: (v) =>
                set({
                    questShowAvailableOnly: v,
                    questVisibilityMode: v ? "hideLocked" : "all",
                }),
            setQuestVisibilityMode: (v) =>
                set({
                    questVisibilityMode: v,
                    questShowAvailableOnly: v === "hideLocked",
                }),
            setQuestActiveDepth: (v) =>
                set({
                    questActiveDepth: Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0,
                }),
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
            setQuestWorkspaceSelectedTraders: (ids) =>
                set({ questWorkspaceSelectedTraders: ids }),
            setQuestWorkspaceFilterByTraderRequirements: (enabled) =>
                set({ questWorkspaceFilterByTraderRequirements: enabled }),
            setQuestWorkspaceSelectedMaps: (mapKeys) =>
                set({ questWorkspaceSelectedMaps: mapKeys }),
            setQuestWorkspaceSelectedStatuses: (statuses) =>
                set({ questWorkspaceSelectedStatuses: statuses }),
            setQuestWorkspaceLockedFilters: (filters) =>
                set((state) => ({
                    questWorkspaceLockedFilters: {
                        ...state.questWorkspaceLockedFilters,
                        ...filters,
                    },
                })),
            setQuestWorkspaceSelectedObjectiveCategories: (categories) =>
                set({ questWorkspaceSelectedObjectiveCategories: categories }),

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
            setItemQuestVisibilityMode: (value) => set({ itemQuestVisibilityMode: value }),
            setItemQuestCustomLookahead: (value) =>
                set({
                    itemQuestCustomLookahead: Number.isFinite(value)
                        ? Math.max(0, Math.floor(value))
                        : 0,
                }),
            setItemQuestCustomLevelLookahead: (value) =>
                set({
                    itemQuestCustomLevelLookahead: Number.isFinite(value)
                        ? Math.max(0, Math.floor(value))
                        : 0,
                }),
            setItemShowFutureFir: (value) => set({ itemShowFutureFir: value }),
            setItemShowIgnored: (value) => set({ itemShowIgnored: value }),

            setHasSeenItemConversionModal: (value) => set({ hasSeenItemConversionModal: value }),
            setHasSeenHideoutLevelWarning: (value) => set({ hasSeenHideoutLevelWarning: value }),

            setGameEdition: (edition) => set({ gameEdition: edition }),
            setGameMode: (mode) =>
                rawSet((state) => {
                    if (state.gameMode === mode) return {};
                    const profile = state.profiles[mode] ?? createDefaultPlayerProfile();
                    if (typeof document !== "undefined") {
                        document.cookie = `tarkov-active-game-mode=${mode}; path=/; max-age=31536000; samesite=lax`;
                    }
                    return { ...profile, gameMode: mode };
                }),
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

            resetHideoutData: () => {
                set(() => ({
                    stationLevels: {},
                    hiddenStations: {},
                    completedRequirements: {},
                }));
            },

            resetItemData: () => {
                set(() => ({
                    itemCounts: {},
                }));
            },

            resetQuestData: () => {
                set(() => ({
                    completedQuests: {},
                    failedQuests: {},
                    questsWithItems: {},
                    ignoredQuests: {},
                    pinnedQuests: {},
                    questChangeHistory: [],
                }));
            },

            resetAll: () => {
                const profiles = createDefaultProfiles();
                if (typeof document !== "undefined") {
                    document.cookie = "tarkov-active-game-mode=PVP; path=/; max-age=31536000; samesite=lax";
                }
                rawSet(() => ({
                    stationLevels: {},
                    hiddenStations: {},
                    completedRequirements: {},
                    completedQuests: {},
                    failedQuests: {},
                    questsWithItems: {},
                    ignoredQuests: {},
                    pinnedQuests: {},
                    questChangeHistory: [],
                    itemCounts: {},
                    checklistViewMode: "all",
                    itemSourceFilter: "all",
                    itemFiltersOpen: false,
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
                    questFenceReputation: 0,
                    questViewMode: "byTrader",
                    questCardSize: "small",
                    questSortMode: "unlockOrder",
                    questSelectedTraders: [],
                    questFaction: "USEC",
                    questShowKappa: false,
                    questShowLightkeeper: false,
                    questSelectedMaps: [],
                    questHideCompleted: false,
                    questShowAvailableOnly: false,
                    questVisibilityMode: "all",
                    questActiveDepth: 2,
                    questShowHandInOnly: false,
                    questShowFirHandInOnly: false,
                    questShowPinnedOnly: false,
                    questShowIgnored: false,
                    questShowDebug: false,
                    questShowPrereqs: true,
                    questSidebarCollapsed: false,
                    questWorkspaceSelectedTraders: [],
                    questWorkspaceFilterByTraderRequirements: true,
                    questWorkspaceSelectedMaps: [],
                    questWorkspaceSelectedStatuses: ["active", "completed", "failed", "locked"],
                    questWorkspaceLockedFilters: { ...DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS },
                    questWorkspaceSelectedObjectiveCategories: [],
                    itemShowPinnedQuestSection: true,
                    itemShowPinnedQuestOnly: false,
                    itemQuestMaxDepth: 1,
                    itemQuestVisibilityMode: "available",
                    itemQuestCustomLookahead: 5,
                    itemQuestCustomLevelLookahead: 5,
                    itemShowFutureFir: false,
                    itemShowIgnored: false,
                    gameEdition: null,
                    gameMode: "PVP",
                    hasCompletedSetup: false,
                    isSetupOpen: false,
                    editionBonusesAppliedFor: null,
                    profiles,
                    deprecatedLegacyState: null,
                    hasConvertedDeprecatedLegacyState: false,
                    hasDismissedDeprecatedLegacyState: false,
                }));
            },
            applyProfilePatch: (patch) => set(patch),
            convertDeprecatedLegacyState: (targetMode) =>
                rawSet((state) => {
                    if (!state.deprecatedLegacyState) return {};
                    const convertedProfile = createPlayerProfileFromLegacyState(
                        state.deprecatedLegacyState,
                    );
                    if (typeof document !== "undefined") {
                        document.cookie = `tarkov-active-game-mode=${targetMode}; path=/; max-age=31536000; samesite=lax`;
                    }
                    return {
                        ...convertedProfile,
                        profiles: {
                            ...state.profiles,
                            [targetMode]: convertedProfile,
                        },
                        gameMode: targetMode,
                        hasConvertedDeprecatedLegacyState: true,
                        hasDismissedDeprecatedLegacyState: false,
                        isSetupOpen: !convertedProfile.hasCompletedSetup,
                    };
                }),
            dismissDeprecatedLegacyState: () =>
                rawSet({ hasDismissedDeprecatedLegacyState: true }),
        });
        },
        {
            name: USER_STORE_STORAGE_KEY,
            version: 22,
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

                if (version < 8) {
                    nextState = {
                        ...nextState,
                        itemQuestVisibilityMode: "available",
                        itemQuestCustomLookahead: 5,
                        itemQuestCustomLevelLookahead: 5,
                        itemShowFutureFir: false,
                    };
                }

                if (version < 9) {
                    nextState = {
                        ...nextState,
                        itemShowIgnored: false,
                    };
                }

                if (version < 10) {
                    nextState = {
                        ...nextState,
                        itemFiltersOpen: false,
                    };
                }

                if (version < 11) {
                    nextState = {
                        ...nextState,
                        questFaction:
                            nextState.questFaction === "BEAR" || nextState.questFaction === "USEC"
                                ? nextState.questFaction
                                : "USEC",
                    };
                }

                if (version < 12) {
                    nextState = {
                        ...nextState,
                        failedQuests: {},
                    };
                }

                if (version < 13) {
                    const questViewMode =
                        nextState.questViewMode === "list"
                            ? "byMap"
                            : nextState.questViewMode === "byMap" ||
                                nextState.questViewMode === "byTrader" ||
                                nextState.questViewMode === "tree" ||
                                nextState.questViewMode === "flatList"
                              ? nextState.questViewMode
                              : "tree";

                    const questSortMode =
                        nextState.questSortMode === "unlockOrder" ||
                        nextState.questSortMode === "level" ||
                        nextState.questSortMode === "xp" ||
                        nextState.questSortMode === "unlockImpact" ||
                        nextState.questSortMode === "default"
                            ? nextState.questSortMode
                            : "default";

                    nextState = {
                        ...nextState,
                        questViewMode,
                        questSortMode,
                    };
                }

                if (version < 14) {
                    nextState = {
                        ...nextState,
                        questVisibilityMode:
                            nextState.questShowAvailableOnly === true ? "hideLocked" : "all",
                        questActiveDepth: 2,
                    };
                }

                if (version < 15) {
                    nextState = {
                        ...nextState,
                        questViewMode:
                            nextState.questViewMode === "byMap" ||
                            nextState.questViewMode === "flatList"
                                ? nextState.questViewMode
                                : "byTrader",
                        questCardSize: "small",
                    };
                }

                if (version < 16) {
                    nextState = {
                        ...nextState,
                        questChangeHistory: [],
                    };
                }

                if (version < 17) {
                    nextState = {
                        ...nextState,
                        questChangeHistory: normalizeQuestChangeHistory(
                            nextState.questChangeHistory,
                        ),
                    };
                }

                if (version < 18) {
                    nextState = {
                        ...nextState,
                        questFenceReputation:
                            typeof nextState.questFenceReputation === "number" &&
                            Number.isFinite(nextState.questFenceReputation)
                                ? nextState.questFenceReputation
                                : 0,
                    };
                }

                if (version < 19) {
                    const deprecatedLegacyState = { ...nextState };
                    const profiles = createDefaultProfiles();
                    nextState = {
                        ...nextState,
                        ...profiles.PVP,
                        profiles,
                        deprecatedLegacyState,
                        gameMode: "PVP",
                    };
                }

                if (version < 20) {
                    const selectedStatuses = Array.isArray(
                        nextState.questWorkspaceSelectedStatuses,
                    )
                        ? nextState.questWorkspaceSelectedStatuses.filter(
                              (status): status is QuestWorkspaceStatus =>
                                  status === "active" ||
                                  status === "completed" ||
                                  status === "failed" ||
                                  status === "locked",
                          )
                        : ["active", "completed", "locked"];

                    nextState = {
                        ...nextState,
                        questWorkspaceSelectedStatuses:
                            selectedStatuses.includes("locked") &&
                            !selectedStatuses.includes("failed")
                                ? [...selectedStatuses, "failed"]
                                : selectedStatuses,
                    };
                }

                if (version < 21) {
                    const lockedFilters =
                        typeof nextState.questWorkspaceLockedFilters === "object" &&
                        nextState.questWorkspaceLockedFilters !== null
                            ? nextState.questWorkspaceLockedFilters as Partial<QuestWorkspaceLockedFilterSettings>
                            : {};

                    nextState = {
                        ...nextState,
                        questSortMode:
                            nextState.questSortMode === "default"
                                ? "unlockOrder"
                                : nextState.questSortMode,
                        questWorkspaceLockedFilters: {
                            ...DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS,
                            ...lockedFilters,
                            playerLevelLookahead:
                                typeof lockedFilters.playerLevelLookahead === "number" &&
                                Number.isFinite(lockedFilters.playerLevelLookahead)
                                    ? Math.max(0, Math.floor(lockedFilters.playerLevelLookahead))
                                    : DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS.playerLevelLookahead,
                            prerequisiteLookahead:
                                typeof lockedFilters.prerequisiteLookahead === "number" &&
                                Number.isFinite(lockedFilters.prerequisiteLookahead)
                                    ? Math.max(1, Math.floor(lockedFilters.prerequisiteLookahead))
                                    : DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS.prerequisiteLookahead,
                        },
                    };
                }

                if (version < 22) {
                    const lockedFilters =
                        typeof nextState.questWorkspaceLockedFilters === "object" &&
                        nextState.questWorkspaceLockedFilters !== null
                            ? nextState.questWorkspaceLockedFilters as Partial<QuestWorkspaceLockedFilterSettings>
                            : {};

                    nextState = {
                        ...nextState,
                        questWorkspaceLockedFilters: {
                            ...DEFAULT_QUEST_WORKSPACE_LOCKED_FILTERS,
                            ...lockedFilters,
                            showAll: lockedFilters.showAll === true,
                        },
                    };
                }

                return nextState as unknown as UserState;
            },
        },
    ),
);
