"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { FullQuest } from "@/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { buildQuestMapGroups, questMatchesSelectedMapGroups } from "../quest-map-groups";
import {
    createQuestMarkerAssignments,
    getAvailableObjectiveCategories,
    getQuestMapKeys,
    getQuestObjectiveCategories,
    getQuestWorkspaceStatus,
    type QuestMarkerAssignment,
    type QuestObjectiveCategory,
    type QuestWorkspaceStatus,
    type QuestWorkspaceStatusInfo,
} from "./quest-workspace-utils";

export type QuestWorkspaceMode = "details" | "planner";
export type QuestFilterSection = "traders" | "maps" | "status" | "types" | null;

interface QuestWorkspaceContextValue {
    quests: FullQuest[];
    questsById: Map<string, FullQuest>;
    filteredQuests: FullQuest[];
    traders: FullQuest["trader"][];
    maps: ReturnType<typeof buildQuestMapGroups>;
    objectiveCategories: QuestObjectiveCategory[];
    statusByQuestId: Map<string, QuestWorkspaceStatusInfo>;
    markerByQuestId: Map<string, QuestMarkerAssignment>;
    selectedQuestId: string | null;
    selectedQuest: FullQuest | null;
    selectedTraderIds: Set<string>;
    selectedMapKeys: Set<string>;
    selectedStatuses: Set<QuestWorkspaceStatus>;
    selectedObjectiveCategories: Set<QuestObjectiveCategory>;
    openFilter: QuestFilterSection;
    searchQuery: string;
    mode: QuestWorkspaceMode;
    plannerMapKey: string | null;
    highlightedQuestId: string | null;
    setSelectedQuestId: (questId: string | null) => void;
    toggleTrader: (traderId: string) => void;
    clearTraders: () => void;
    toggleMap: (mapKey: string) => void;
    clearMaps: () => void;
    toggleStatus: (status: QuestWorkspaceStatus) => void;
    toggleObjectiveCategory: (category: QuestObjectiveCategory) => void;
    clearObjectiveCategories: () => void;
    setOpenFilter: (section: QuestFilterSection) => void;
    setSearchQuery: (query: string) => void;
    setMode: (mode: QuestWorkspaceMode) => void;
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
    const [selectedTraderIds, setSelectedTraderIds] = useState<Set<string>>(() => new Set());
    const [selectedMapKeys, setSelectedMapKeys] = useState<Set<string>>(() => new Set());
    const [selectedStatuses, setSelectedStatuses] = useState<Set<QuestWorkspaceStatus>>(
        () => new Set(["active", "completed", "locked"]),
    );
    const [selectedObjectiveCategories, setSelectedObjectiveCategories] = useState<Set<QuestObjectiveCategory>>(() => new Set());
    const [openFilter, setOpenFilter] = useState<QuestFilterSection>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [mode, setMode] = useState<QuestWorkspaceMode>("details");
    const [plannerMapKey, setPlannerMapKey] = useState<string | null>(null);
    const [highlightedQuestId, setHighlightedQuestId] = useState<string | null>(null);
    const profile = useUserStore(
        useShallow((state) => ({
            playerLevel: state.playerLevel,
            prestigeLevel: state.prestigeLevel,
            faction: state.questFaction,
            traderLoyaltyLevels: state.questTraderLoyaltyLevels,
            completedQuests: state.completedQuests,
            failedQuests: state.failedQuests,
        })),
    );

    const questsById = useMemo(() => new Map(quests.map((quest) => [quest.id, quest])), [quests]);
    const statusByQuestId = useMemo(
        () => new Map(quests.map((quest) => [quest.id, getQuestWorkspaceStatus(quest, profile)])),
        [profile, quests],
    );
    const traders = useMemo(() => {
        const unique = new Map<string, FullQuest["trader"]>();
        quests.forEach((quest) => unique.set(quest.trader.id, quest.trader));
        return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [quests]);
    const maps = useMemo(() => buildQuestMapGroups(quests), [quests]);
    const objectiveCategories = useMemo(() => getAvailableObjectiveCategories(quests), [quests]);
    const markerByQuestId = useMemo(
        () => createQuestMarkerAssignments(
            plannerMapKey
                ? quests.filter((quest) => getQuestMapKeys(quest).has(plannerMapKey))
                : [],
        ),
        [plannerMapKey, quests],
    );
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredQuests = useMemo(() => quests.filter((quest) => {
        if (selectedTraderIds.size > 0 && !selectedTraderIds.has(quest.trader.id)) return false;
        if (selectedMapKeys.size > 0 && !questMatchesSelectedMapGroups(quest, selectedMapKeys)) return false;
        const status = statusByQuestId.get(quest.id);
        if (status && !selectedStatuses.has(status.status)) return false;
        if (selectedObjectiveCategories.size > 0) {
            const categories = getQuestObjectiveCategories(quest);
            if (![...selectedObjectiveCategories].some((category) => categories.has(category))) return false;
        }
        if (normalizedSearch) {
            const haystack = `${quest.name} ${quest.trader.name} ${quest.map?.name ?? ""} ${quest.objectives.map((objective) => objective.description).join(" ")}`.toLowerCase();
            if (!haystack.includes(normalizedSearch)) return false;
        }
        return true;
    }), [normalizedSearch, quests, selectedMapKeys, selectedObjectiveCategories, selectedStatuses, selectedTraderIds, statusByQuestId]);

    const selectPlannerMap = (mapKey: string) => {
        setPlannerMapKey(mapKey);
        setSelectedMapKeys(new Set([mapKey]));
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
            selectedMapKeys,
            selectedStatuses,
            selectedObjectiveCategories,
            openFilter,
            searchQuery,
            mode,
            plannerMapKey,
            highlightedQuestId,
            setSelectedQuestId,
            toggleTrader: (id) => setSelectedTraderIds((current) => toggleSetValue(current, id)),
            clearTraders: () => setSelectedTraderIds(new Set()),
            toggleMap: (key) => setSelectedMapKeys((current) => toggleSetValue(current, key)),
            clearMaps: () => setSelectedMapKeys(new Set()),
            toggleStatus: (status) => setSelectedStatuses((current) => toggleSetValue(current, status)),
            toggleObjectiveCategory: (category) => setSelectedObjectiveCategories((current) => toggleSetValue(current, category)),
            clearObjectiveCategories: () => setSelectedObjectiveCategories(new Set()),
            setOpenFilter,
            setSearchQuery,
            setMode,
            selectPlannerMap,
            clearPlannerMap: () => {
                setPlannerMapKey(null);
                setSelectedMapKeys(new Set());
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
