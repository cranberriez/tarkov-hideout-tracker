"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { FullQuest } from "@/types";
import { useUserStore, type QuestSortMode } from "@/lib/stores/useUserStore";
import { buildQuestMapGroups, questMatchesSelectedMapGroups } from "../quest-map-groups";
import {
    questMatchesTraderRequirementProfile,
} from "@/lib/utils/quest-trader-gates";
import {
    getAvailableObjectiveCategories,
    getQuestMapKeys,
    getQuestObjectiveCategories,
    getQuestWorkspaceStatus,
    type QuestObjectiveCategory,
    type QuestWorkspaceStatus,
    type QuestWorkspaceStatusInfo,
} from "./quest-workspace-utils";
import {
    createQuestMarkerStyles,
    type QuestMarkerStyle,
} from "./raid-planner-markers";

export type QuestWorkspaceMode = "details" | "planner";
export type QuestListMode = "quests" | "history";
export type QuestFilterSection = "traders" | "maps" | "status" | "filters" | null;

interface QuestWorkspaceContextValue {
    quests: FullQuest[];
    questsById: Map<string, FullQuest>;
    filteredQuests: FullQuest[];
    traders: FullQuest["trader"][];
    maps: ReturnType<typeof buildQuestMapGroups>;
    objectiveCategories: QuestObjectiveCategory[];
    statusByQuestId: Map<string, QuestWorkspaceStatusInfo>;
    markerByQuestId: Map<string, QuestMarkerStyle>;
    selectedQuestId: string | null;
    selectedQuest: FullQuest | null;
    selectedTraderIds: Set<string>;
    filterByTraderRequirements: boolean;
    selectedMapKeys: Set<string>;
    selectedStatuses: Set<QuestWorkspaceStatus>;
    selectedObjectiveCategories: Set<QuestObjectiveCategory>;
    groupByTrader: boolean;
    groupByLoyaltyLevel: boolean;
    sortMode: QuestSortMode;
    openFilter: QuestFilterSection;
    searchQuery: string;
    mode: QuestWorkspaceMode;
    listMode: QuestListMode;
    plannerMapKey: string | null;
    highlightedQuestId: string | null;
    setSelectedQuestId: (questId: string | null) => void;
    toggleTrader: (traderId: string) => void;
    clearTraders: () => void;
    setFilterByTraderRequirements: (enabled: boolean) => void;
    toggleMap: (mapKey: string) => void;
    clearMaps: () => void;
    toggleStatus: (status: QuestWorkspaceStatus) => void;
    toggleObjectiveCategory: (category: QuestObjectiveCategory) => void;
    clearObjectiveCategories: () => void;
    setGroupByTrader: (enabled: boolean) => void;
    setGroupByLoyaltyLevel: (enabled: boolean) => void;
    setSortMode: (mode: QuestSortMode) => void;
    setOpenFilter: (section: QuestFilterSection) => void;
    setSearchQuery: (query: string) => void;
    setMode: (mode: QuestWorkspaceMode) => void;
    setListMode: (mode: QuestListMode) => void;
    retainQuestAfterCompletion: (questId: string) => void;
    selectPlannerMap: (mapKey: string) => void;
    clearPlannerMap: () => void;
    setHighlightedQuestId: (questId: string | null) => void;
}

const QuestWorkspaceContext = createContext<QuestWorkspaceContextValue | null>(null);

function toggleSetValue<T>(current: Set<T>, value: T) {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
}

export function QuestWorkspaceProvider({ quests, children }: { quests: FullQuest[]; children: ReactNode }) {
    const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
    const [openFilter, setOpenFilter] = useState<QuestFilterSection>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [mode, setMode] = useState<QuestWorkspaceMode>("details");
    const [listMode, setListMode] = useState<QuestListMode>("quests");
    const [groupByTrader, setGroupByTrader] = useState(true);
    const [groupByLoyaltyLevel, setGroupByLoyaltyLevel] = useState(true);
    const [retainedCompletedQuestIds, setRetainedCompletedQuestIds] = useState<Set<string>>(() => new Set());
    const [plannerMapKey, setPlannerMapKey] = useState<string | null>(null);
    const [highlightedQuestId, setHighlightedQuestId] = useState<string | null>(null);
    const store = useUserStore(
        useShallow((state) => ({
            playerLevel: state.playerLevel,
            prestigeLevel: state.prestigeLevel,
            faction: state.questFaction,
            traderLoyaltyLevels: state.questTraderLoyaltyLevels,
            fenceReputation: state.questFenceReputation,
            completedQuests: state.completedQuests,
            failedQuests: state.failedQuests,
            selectedTraderIds: state.questWorkspaceSelectedTraders,
            filterByTraderRequirements: state.questWorkspaceFilterByTraderRequirements,
            selectedMapKeys: state.questWorkspaceSelectedMaps,
            selectedStatuses: state.questWorkspaceSelectedStatuses,
            selectedObjectiveCategories: state.questWorkspaceSelectedObjectiveCategories,
            sortMode: state.questSortMode,
            setSelectedTraderIds: state.setQuestWorkspaceSelectedTraders,
            setFilterByTraderRequirements: state.setQuestWorkspaceFilterByTraderRequirements,
            setSelectedMapKeys: state.setQuestWorkspaceSelectedMaps,
            setSelectedStatuses: state.setQuestWorkspaceSelectedStatuses,
            setSelectedObjectiveCategories:
                state.setQuestWorkspaceSelectedObjectiveCategories,
            setSortMode: state.setQuestSortMode,
        })),
    );
    const profile = useMemo(
        () => ({
            playerLevel: store.playerLevel,
            prestigeLevel: store.prestigeLevel,
            faction: store.faction,
            traderLoyaltyLevels: store.traderLoyaltyLevels,
            fenceReputation: store.fenceReputation,
            completedQuests: store.completedQuests,
            failedQuests: store.failedQuests,
        }),
        [store.playerLevel, store.prestigeLevel, store.faction, store.traderLoyaltyLevels,
            store.fenceReputation, store.completedQuests, store.failedQuests],
    );
    const selectedTraderIds = useMemo(() => new Set(store.selectedTraderIds), [store.selectedTraderIds]);
    const selectedMapKeys = useMemo(() => new Set(store.selectedMapKeys), [store.selectedMapKeys]);
    const selectedStatuses = useMemo(() => new Set(store.selectedStatuses), [store.selectedStatuses]);
    const selectedObjectiveCategories = useMemo(
        () => new Set(store.selectedObjectiveCategories),
        [store.selectedObjectiveCategories],
    );
    const filterByTraderRequirements = store.filterByTraderRequirements;
    const previousCompletedQuests = useRef(profile.completedQuests);

    const questsById = useMemo(() => new Map(quests.map((quest) => [quest.id, quest])), [quests]);
    const statusByQuestId = useMemo(
        () => new Map(quests.map((quest) => [quest.id, getQuestWorkspaceStatus(quest, profile, questsById)])),
        [profile, quests, questsById],
    );
    const traders = useMemo(() => {
        const unique = new Map<string, FullQuest["trader"]>();
        quests.forEach((quest) => unique.set(quest.trader.id, quest.trader));
        return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [quests]);
    const maps = useMemo(() => buildQuestMapGroups(quests), [quests]);
    const objectiveCategories = useMemo(() => getAvailableObjectiveCategories(quests), [quests]);
    const markerByQuestId = useMemo(
        () => createQuestMarkerStyles(
            plannerMapKey
                ? quests.filter((quest) => getQuestMapKeys(quest).has(plannerMapKey))
                : [],
        ),
        [plannerMapKey, quests],
    );
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const onlyActiveSelected = selectedStatuses.size === 1 && selectedStatuses.has("active");
    const filteredQuests = useMemo(() => quests.filter((quest) => {
        if (selectedTraderIds.size > 0 && !selectedTraderIds.has(quest.trader.id)) return false;
        if (
            filterByTraderRequirements &&
            !questMatchesTraderRequirementProfile(quest, profile)
        ) return false;
        if (selectedMapKeys.size > 0 && !questMatchesSelectedMapGroups(quest, selectedMapKeys)) return false;
        const status = statusByQuestId.get(quest.id);
        if (
            status &&
            !selectedStatuses.has(status.status) &&
            !(onlyActiveSelected && status.status === "completed" && retainedCompletedQuestIds.has(quest.id))
        ) return false;
        if (selectedObjectiveCategories.size > 0) {
            const categories = getQuestObjectiveCategories(quest);
            if (![...selectedObjectiveCategories].some((category) => categories.has(category))) return false;
        }
        if (normalizedSearch) {
            const haystack = `${quest.name} ${quest.trader.name} ${quest.map?.name ?? ""} ${quest.objectives.map((objective) => objective.description).join(" ")}`.toLowerCase();
            if (!haystack.includes(normalizedSearch)) return false;
        }
        return true;
    }), [filterByTraderRequirements, normalizedSearch, onlyActiveSelected, profile, quests, retainedCompletedQuestIds, selectedMapKeys, selectedObjectiveCategories, selectedStatuses, selectedTraderIds, statusByQuestId]);

    useEffect(() => {
        const previous = previousCompletedQuests.current;
        previousCompletedQuests.current = profile.completedQuests;
        if (!onlyActiveSelected) return;

        const newlyCompleted = quests
            .filter((quest) => !previous[quest.id] && profile.completedQuests[quest.id])
            .map((quest) => quest.id);
        if (newlyCompleted.length === 0) return;

        setRetainedCompletedQuestIds((current) => new Set([...current, ...newlyCompleted]));
    }, [onlyActiveSelected, profile.completedQuests, quests]);

    const clearRetainedCompletedQuests = () => setRetainedCompletedQuestIds(new Set());
    const retainQuestAfterCompletion = (questId: string) => {
        if (!onlyActiveSelected) return;
        setRetainedCompletedQuestIds((current) => new Set(current).add(questId));
    };

    const selectPlannerMap = (mapKey: string) => {
        setPlannerMapKey(mapKey);
        store.setSelectedMapKeys([mapKey]);
        setMode("planner");
    };

    return (
        <QuestWorkspaceContext.Provider value={{
            quests,
            questsById,
            filteredQuests,
            traders,
            maps,
            objectiveCategories,
            statusByQuestId,
            markerByQuestId,
            selectedQuestId,
            selectedQuest: selectedQuestId ? questsById.get(selectedQuestId) ?? null : null,
            selectedTraderIds,
            filterByTraderRequirements,
            selectedMapKeys,
            selectedStatuses,
            selectedObjectiveCategories,
            groupByTrader,
            groupByLoyaltyLevel,
            sortMode: store.sortMode,
            openFilter,
            searchQuery,
            mode,
            listMode,
            plannerMapKey,
            highlightedQuestId,
            setSelectedQuestId,
            toggleTrader: (id) => { clearRetainedCompletedQuests(); store.setSelectedTraderIds([...toggleSetValue(selectedTraderIds, id)]); },
            clearTraders: () => { clearRetainedCompletedQuests(); store.setSelectedTraderIds([]); },
            setFilterByTraderRequirements: (enabled) => { clearRetainedCompletedQuests(); store.setFilterByTraderRequirements(enabled); },
            toggleMap: (key) => { clearRetainedCompletedQuests(); store.setSelectedMapKeys([...toggleSetValue(selectedMapKeys, key)]); },
            clearMaps: () => { clearRetainedCompletedQuests(); store.setSelectedMapKeys([]); },
            toggleStatus: (status) => { clearRetainedCompletedQuests(); store.setSelectedStatuses([...toggleSetValue(selectedStatuses, status)]); },
            toggleObjectiveCategory: (category) => { clearRetainedCompletedQuests(); store.setSelectedObjectiveCategories([...toggleSetValue(selectedObjectiveCategories, category)]); },
            clearObjectiveCategories: () => { clearRetainedCompletedQuests(); store.setSelectedObjectiveCategories([]); },
            setGroupByTrader,
            setGroupByLoyaltyLevel,
            setSortMode: store.setSortMode,
            setOpenFilter,
            setSearchQuery: (query) => { clearRetainedCompletedQuests(); setSearchQuery(query); },
            setMode,
            setListMode,
            retainQuestAfterCompletion,
            selectPlannerMap,
            clearPlannerMap: () => {
                setPlannerMapKey(null);
                store.setSelectedMapKeys([]);
            },
            setHighlightedQuestId,
        }}>
            {children}
        </QuestWorkspaceContext.Provider>
    );
}

export function useQuestWorkspace() {
    const context = useContext(QuestWorkspaceContext);
    if (!context) throw new Error("useQuestWorkspace must be used within QuestWorkspaceProvider");
    return context;
}
