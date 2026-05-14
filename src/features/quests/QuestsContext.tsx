"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { FullQuest } from "@/types";
import { hasFirGiveItemObjectives, hasGiveItemObjectives } from "@/lib/utils/quest-item-index";
import { compareQuestTradersByOrder } from "@/lib/cfg/questTraderOrder";
import {
    getVisibleSyncCandidatesForTrader as getVisibleSyncCandidatesForTraderFromProfile,
    isQuestAvailableForProfile,
    matchesFactionVisibility,
    syncTraderProgress,
    type FactionFilter,
    type QuestSyncProfile,
    type QuestSyncResult,
} from "./quest-sync";

interface LastQuestSyncAction extends QuestSyncResult {
    traderName: string;
}

interface QuestsContextValue {
    quests: FullQuest[];

    selectedTraders: Set<string>;
    faction: FactionFilter | null;
    showKappa: boolean;
    showLightkeeper: boolean;
    selectedMaps: Set<string>;
    hideCompleted: boolean;
    showAvailableOnly: boolean;
    showHandInOnly: boolean;
    showFirHandInOnly: boolean;
    showPinnedOnly: boolean;
    showIgnored: boolean;
    showDebug: boolean;
    searchQuery: string;
    syncProfile: QuestSyncProfile;
    lastQuestSyncAction: LastQuestSyncAction | null;

    filteredQuests: FullQuest[];
    questsById: Map<string, FullQuest>;
    kappaQuestIds: Set<string>;
    lightkeeperQuestIds: Set<string>;
    leadsToByQuestId: Map<string, string[]>;
    traders: FullQuest["trader"][];
    allMaps: [string, string][];
    completedCount: number;

    toggleTrader: (id: string) => void;
    clearTraders: () => void;
    toggleMap: (normalizedName: string) => void;
    clearMaps: () => void;
    viewMode: "list" | "byTrader" | "tree";
    setViewMode: (mode: "list" | "byTrader" | "tree") => void;

    toggleFaction: (f: FactionFilter) => void;
    toggleKappa: () => void;
    toggleLightkeeper: () => void;
    setHideCompleted: (value: boolean) => void;
    setShowAvailableOnly: (value: boolean) => void;
    setShowHandInOnly: (value: boolean) => void;
    setShowFirHandInOnly: (value: boolean) => void;
    setShowPinnedOnly: (value: boolean) => void;
    setShowIgnored: (value: boolean) => void;
    setShowDebug: (value: boolean) => void;
    setSearchQuery: (value: string) => void;
    getVisibleSyncCandidatesForTrader: (traderId: string) => FullQuest[];
    syncTraderSelection: (traderId: string, selectedVisibleQuestIds: string[]) => LastQuestSyncAction;
    undoLastQuestSync: () => boolean;
    applyTraderSyncReviewFilters: (traderId: string) => void;
}

const QuestsContext = createContext<QuestsContextValue | null>(null);

export function useQuestsContext() {
    const ctx = useContext(QuestsContext);
    if (!ctx) throw new Error("useQuestsContext must be used within QuestsProvider");
    return ctx;
}

function getTransitivePrereqs(rootIds: Set<string>, questsById: Map<string, FullQuest>): Set<string> {
    const result = new Set(rootIds);
    const queue = [...rootIds];
    while (queue.length > 0) {
        const id = queue.pop()!;
        const quest = questsById.get(id);
        if (!quest) continue;
        for (const req of quest.taskRequirements) {
            if (!result.has(req.task.id)) {
                result.add(req.task.id);
                queue.push(req.task.id);
            }
        }
    }
    return result;
}

function buildSyncProfile(state: ReturnType<typeof useUserStore.getState>): QuestSyncProfile {
    return {
        playerLevel: state.playerLevel,
        prestigeLevel: state.prestigeLevel,
        faction: state.questFaction,
        traderLoyaltyLevels: state.questTraderLoyaltyLevels,
        completedQuests: state.completedQuests,
    };
}

function restoreRecordValues(
    target: Record<string, boolean>,
    previousValues: Record<string, boolean | undefined>,
    ids: string[],
) {
    for (const id of ids) {
        const previousValue = previousValues[id];
        if (previousValue === undefined) delete target[id];
        else target[id] = previousValue;
    }
}

export function QuestsProvider({ quests, children }: { quests: FullQuest[]; children: ReactNode }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [lastQuestSyncAction, setLastQuestSyncAction] = useState<LastQuestSyncAction | null>(null);
    const {
        completedQuests,
        ignoredQuests,
        playerLevel,
        prestigeLevel,
        questTraderLoyaltyLevels,
        questViewMode: viewMode,
        questSelectedTraders,
        questFaction: faction,
        questShowKappa: showKappa,
        questShowLightkeeper: showLightkeeper,
        questSelectedMaps,
        questHideCompleted: hideCompleted,
        questShowAvailableOnly: showAvailableOnly,
        questShowHandInOnly: showHandInOnly,
        questShowFirHandInOnly: showFirHandInOnly,
        questShowPinnedOnly: showPinnedOnly,
        questShowIgnored: showIgnored,
        questShowDebug: showDebug,
        pinnedQuests,
        setQuestViewMode: setViewMode,
        setQuestSelectedTraders,
        setQuestFaction,
        setQuestShowKappa,
        setQuestShowLightkeeper,
        setQuestSelectedMaps,
        setQuestHideCompleted: setHideCompleted,
        setQuestShowAvailableOnly: setShowAvailableOnly,
        setQuestShowHandInOnly: setShowHandInOnly,
        setQuestShowFirHandInOnly: setShowFirHandInOnly,
        setQuestShowPinnedOnly: setShowPinnedOnly,
        setQuestShowIgnored: setShowIgnored,
        setQuestShowDebug: setShowDebug,
    } = useUserStore();

    const selectedTraders = useMemo(() => new Set(questSelectedTraders), [questSelectedTraders]);
    const selectedMaps = useMemo(() => new Set(questSelectedMaps), [questSelectedMaps]);

    const syncProfile = useMemo(
        () => ({
            playerLevel,
            prestigeLevel,
            faction,
            traderLoyaltyLevels: questTraderLoyaltyLevels,
            completedQuests,
        }),
        [completedQuests, faction, playerLevel, prestigeLevel, questTraderLoyaltyLevels],
    );

    const questsById = useMemo(() => new Map(quests.map((q) => [q.id, q])), [quests]);

    const kappaQuestIds = useMemo(
        () => getTransitivePrereqs(new Set(quests.filter((q) => q.kappaRequired).map((q) => q.id)), questsById),
        [quests, questsById],
    );

    const lightkeeperQuestIds = useMemo(
        () => getTransitivePrereqs(new Set(quests.filter((q) => q.lightkeeperRequired).map((q) => q.id)), questsById),
        [quests, questsById],
    );

    const leadsToByQuestId = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const quest of quests) {
            for (const req of quest.taskRequirements) {
                const arr = map.get(req.task.id) ?? [];
                arr.push(quest.id);
                map.set(req.task.id, arr);
            }
        }
        return map;
    }, [quests]);

    const traders = useMemo(() => {
        const map = new Map<string, FullQuest["trader"]>();
        for (const q of quests) {
            if (!map.has(q.trader.id)) map.set(q.trader.id, q.trader);
        }
        return [...map.values()].sort((a, b) => compareQuestTradersByOrder(a.name, b.name));
    }, [quests]);

    const allMaps = useMemo(() => {
        const map = new Map<string, string>();
        for (const q of quests) {
            if (q.map) map.set(q.map.normalizedName, q.map.name);
        }
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [quests]);

    const filteredQuests = useMemo(() => {
        return quests.filter((quest) => {
            const normalizedSearch = searchQuery.trim().toLowerCase();
            if (
                normalizedSearch &&
                !quest.name.toLowerCase().includes(normalizedSearch) &&
                !quest.trader.name.toLowerCase().includes(normalizedSearch) &&
                !(quest.map?.name.toLowerCase().includes(normalizedSearch) ?? false)
            ) {
                return false;
            }

            if (hideCompleted && completedQuests[quest.id]) return false;
            if (!showIgnored && ignoredQuests[quest.id]) return false;
            if (showAvailableOnly && !isQuestAvailableForProfile(quest, syncProfile, questsById)) return false;
            if (showPinnedOnly && !pinnedQuests[quest.id]) return false;
            if (showHandInOnly && !hasGiveItemObjectives(quest)) return false;
            if (showFirHandInOnly && !hasFirGiveItemObjectives(quest)) return false;
            if (selectedTraders.size > 0 && !selectedTraders.has(quest.trader.id)) return false;
            if (!matchesFactionVisibility(quest.factionName, faction)) return false;

            if (showKappa || showLightkeeper) {
                if (!((showKappa && kappaQuestIds.has(quest.id)) || (showLightkeeper && lightkeeperQuestIds.has(quest.id))))
                    return false;
            }

            if (selectedMaps.size > 0 && (!quest.map || !selectedMaps.has(quest.map.normalizedName))) {
                return false;
            }

            return true;
        });
    }, [
        quests,
        searchQuery,
        hideCompleted,
        completedQuests,
        showIgnored,
        ignoredQuests,
        showAvailableOnly,
        syncProfile,
        questsById,
        showPinnedOnly,
        pinnedQuests,
        showHandInOnly,
        showFirHandInOnly,
        selectedTraders,
        faction,
        showKappa,
        showLightkeeper,
        kappaQuestIds,
        lightkeeperQuestIds,
        selectedMaps,
    ]);

    const completedCount = useMemo(
        () => quests.filter((q) => completedQuests[q.id]).length,
        [quests, completedQuests],
    );

    const toggleTrader = (id: string) => {
        const next = new Set(questSelectedTraders);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setQuestSelectedTraders([...next]);
    };

    const clearTraders = () => setQuestSelectedTraders([]);

    const toggleMap = (normalizedName: string) => {
        const next = new Set(questSelectedMaps);
        if (next.has(normalizedName)) next.delete(normalizedName);
        else next.add(normalizedName);
        setQuestSelectedMaps([...next]);
    };

    const clearMaps = () => setQuestSelectedMaps([]);

    const toggleFaction = (nextFaction: FactionFilter) => setQuestFaction(faction === nextFaction ? null : nextFaction);
    const toggleKappa = () => setQuestShowKappa(!showKappa);
    const toggleLightkeeper = () => setQuestShowLightkeeper(!showLightkeeper);

    const getVisibleSyncCandidatesForTrader = (traderId: string) =>
        getVisibleSyncCandidatesForTraderFromProfile(quests, traderId, syncProfile);

    const syncTraderSelection = (traderId: string, selectedVisibleQuestIds: string[]) => {
        const state = useUserStore.getState();
        const result = syncTraderProgress({
            quests,
            traderId,
            selectedVisibleQuestIds,
            profile: buildSyncProfile(state),
            questsWithItems: state.questsWithItems,
        });

        if (result.completedIds.length > 0) {
            useUserStore.setState({
                completedQuests: result.nextCompletedQuests,
                questsWithItems: result.nextQuestsWithItems,
            });
        }

        const action = {
            ...result,
            traderName: quests.find((quest) => quest.trader.id === traderId)?.trader.name ?? "Trader",
        };
        setLastQuestSyncAction(action);
        return action;
    };

    const undoLastQuestSync = () => {
        if (!lastQuestSyncAction || lastQuestSyncAction.completedIds.length === 0) return false;

        useUserStore.setState((state) => {
            const completedQuestsDraft = { ...state.completedQuests };
            const questsWithItemsDraft = { ...state.questsWithItems };

            restoreRecordValues(
                completedQuestsDraft,
                lastQuestSyncAction.previousCompletedQuests,
                lastQuestSyncAction.completedIds,
            );
            restoreRecordValues(
                questsWithItemsDraft,
                lastQuestSyncAction.previousQuestsWithItems,
                lastQuestSyncAction.completedIds,
            );

            return {
                completedQuests: completedQuestsDraft,
                questsWithItems: questsWithItemsDraft,
            };
        });

        setLastQuestSyncAction(null);
        return true;
    };

    const applyTraderSyncReviewFilters = (traderId: string) => {
        setQuestSelectedTraders([traderId]);
        setQuestSelectedMaps([]);
        setHideCompleted(false);
        setShowAvailableOnly(true);
        setShowHandInOnly(false);
        setShowFirHandInOnly(false);
        setShowPinnedOnly(false);
        setShowIgnored(true);
        setSearchQuery("");
    };

    return (
        <QuestsContext.Provider
            value={{
                quests,
                selectedTraders,
                faction,
                showKappa,
                showLightkeeper,
                selectedMaps,
                hideCompleted,
                showAvailableOnly,
                showHandInOnly,
                showFirHandInOnly,
                showPinnedOnly,
                showIgnored,
                showDebug,
                searchQuery,
                syncProfile,
                lastQuestSyncAction,
                filteredQuests,
                questsById,
                kappaQuestIds,
                lightkeeperQuestIds,
                leadsToByQuestId,
                traders,
                allMaps,
                completedCount,
                toggleTrader,
                clearTraders,
                toggleMap,
                clearMaps,
                viewMode,
                setViewMode,
                toggleFaction,
                toggleKappa,
                toggleLightkeeper,
                setHideCompleted,
                setShowAvailableOnly,
                setShowHandInOnly,
                setShowFirHandInOnly,
                setShowPinnedOnly,
                setShowIgnored,
                setShowDebug,
                setSearchQuery,
                getVisibleSyncCandidatesForTrader,
                syncTraderSelection,
                undoLastQuestSync,
                applyTraderSyncReviewFilters,
            }}
        >
            {children}
        </QuestsContext.Provider>
    );
}

export { matchesFactionVisibility };
