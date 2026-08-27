"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import {
    useUserStore,
    type QuestSortMode,
    type QuestViewMode,
    type QuestVisibilityMode,
} from "@/lib/stores/useUserStore";
import type { FullQuest } from "@/types";
import { hasFirGiveItemObjectives, hasGiveItemObjectives } from "@/lib/utils/quest-item-index";
import { compareQuestTradersByOrder } from "@/lib/cfg/questTraderOrder";
import {
    getSyncCandidatesForTrader as getSyncCandidatesForTraderFromProfile,
    isQuestAvailableForProfile,
    matchesFactionVisibility,
    syncTraderProgress,
    type FactionFilter,
    type QuestSyncProfile,
    type QuestSyncResult,
} from "./quest-sync";
import {
    buildQuestMapGroups,
    getQuestMapGroupKey,
    questMatchesSelectedMapGroups,
} from "./quest-map-groups";
import { useUIStore } from "@/lib/stores/useUIStore";
import { collectCompleteCascade, collectUncompleteCascade } from "./quest-cascade";
import {
    buildQuestFailureMap,
    getAutoFailedQuestIds,
    isQuestDisabledByCompletedFailedRequirement,
    questCanFail,
} from "@/lib/utils/quest-failures";

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
    visibilityMode: QuestVisibilityMode;
    activeDepth: number;
    showHandInOnly: boolean;
    showFirHandInOnly: boolean;
    showPinnedOnly: boolean;
    showIgnored: boolean;
    showDebug: boolean;
    showPrereqs: boolean;
    searchQuery: string;
    syncProfile: QuestSyncProfile;
    lastQuestSyncAction: LastQuestSyncAction | null;

    filteredQuests: FullQuest[];
    questsById: Map<string, FullQuest>;
    failureMap: Map<string, string[]>;
    kappaQuestIds: Set<string>;
    lightkeeperQuestIds: Set<string>;
    leadsToByQuestId: Map<string, string[]>;
    traders: FullQuest["trader"][];
    allMaps: [string, string][];
    completedCount: number;
    failedCount: number;

    toggleTrader: (id: string) => void;
    showOnlyTrader: (id: string) => void;
    clearTraders: () => void;
    toggleMap: (normalizedName: string) => void;
    clearMaps: () => void;
    viewMode: QuestViewMode;
    sortMode: QuestSortMode;
    setViewMode: (mode: QuestViewMode) => void;
    setSortMode: (mode: QuestSortMode) => void;

    toggleFaction: (f: FactionFilter) => void;
    toggleKappa: () => void;
    toggleLightkeeper: () => void;
    setHideCompleted: (value: boolean) => void;
    setShowAvailableOnly: (value: boolean) => void;
    setVisibilityMode: (value: QuestVisibilityMode) => void;
    setActiveDepth: (value: number) => void;
    setShowHandInOnly: (value: boolean) => void;
    setShowFirHandInOnly: (value: boolean) => void;
    setShowPinnedOnly: (value: boolean) => void;
    setShowIgnored: (value: boolean) => void;
    setShowDebug: (value: boolean) => void;
    setShowPrereqs: (value: boolean) => void;
    setSearchQuery: (value: string) => void;
    getSyncCandidatesForTrader: (traderId: string) => FullQuest[];
    requestToggleQuestCompletion: (questId: string) => void;
    requestFailQuest: (questId: string) => void;
    requestResetQuestStatus: (questId: string) => void;
    isQuestDisabled: (questId: string) => boolean;
    previewTraderSelection: (
        traderId: string,
        selectedQuestIds: string[],
        enableInference?: boolean,
        allowedSensitiveBackfillQuestIds?: string[],
        deniedSensitiveBackfillQuestIds?: string[],
    ) => QuestSyncResult;
    syncTraderSelection: (
        traderId: string,
        selectedQuestIds: string[],
        enableInference?: boolean,
        allowedSensitiveBackfillQuestIds?: string[],
        deniedSensitiveBackfillQuestIds?: string[],
    ) => LastQuestSyncAction;
    undoLastQuestSync: () => boolean;
    onItemClick: ((itemId: string) => void) | null;
    onQuestClick: ((questId: string) => void) | null;
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
        failedQuests: state.failedQuests,
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

export function QuestsProvider({
    quests,
    children,
    onItemClick,
    onQuestClick,
}: {
    quests: FullQuest[];
    children: ReactNode;
    onItemClick?: (itemId: string) => void;
    onQuestClick?: (questId: string) => void;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [lastQuestSyncAction, setLastQuestSyncAction] = useState<LastQuestSyncAction | null>(null);
    const {
        completedQuests,
        failedQuests,
        ignoredQuests,
        playerLevel,
        prestigeLevel,
        questTraderLoyaltyLevels,
        viewMode,
        sortMode,
        questSelectedTraders,
        faction,
        showKappa,
        showLightkeeper,
        questSelectedMaps,
        hideCompleted,
        showAvailableOnly,
        visibilityMode,
        activeDepth,
        showHandInOnly,
        showFirHandInOnly,
        showPinnedOnly,
        showIgnored,
        showDebug,
        showPrereqs,
        pinnedQuests,
        setViewMode,
        setSortMode,
        setQuestSelectedTraders,
        setQuestFaction,
        setQuestShowKappa,
        setQuestShowLightkeeper,
        setQuestSelectedMaps,
        setHideCompleted,
        setShowAvailableOnly,
        setVisibilityMode,
        setActiveDepth,
        setShowHandInOnly,
        setShowFirHandInOnly,
        setShowPinnedOnly,
        setShowIgnored,
        setShowDebug,
        setShowPrereqs,
    } = useUserStore(
        useShallow((state) => ({
            completedQuests: state.completedQuests,
            failedQuests: state.failedQuests,
            ignoredQuests: state.ignoredQuests,
            playerLevel: state.playerLevel,
            prestigeLevel: state.prestigeLevel,
            questTraderLoyaltyLevels: state.questTraderLoyaltyLevels,
            viewMode: state.questViewMode,
            sortMode: state.questSortMode,
            questSelectedTraders: state.questSelectedTraders,
            faction: state.questFaction,
            showKappa: state.questShowKappa,
            showLightkeeper: state.questShowLightkeeper,
            questSelectedMaps: state.questSelectedMaps,
            hideCompleted: state.questHideCompleted,
            showAvailableOnly: state.questShowAvailableOnly,
            visibilityMode: state.questVisibilityMode,
            activeDepth: state.questActiveDepth,
            showHandInOnly: state.questShowHandInOnly,
            showFirHandInOnly: state.questShowFirHandInOnly,
            showPinnedOnly: state.questShowPinnedOnly,
            showIgnored: state.questShowIgnored,
            showDebug: state.questShowDebug,
            showPrereqs: state.questShowPrereqs,
            pinnedQuests: state.pinnedQuests,
            setViewMode: state.setQuestViewMode,
            setSortMode: state.setQuestSortMode,
            setQuestSelectedTraders: state.setQuestSelectedTraders,
            setQuestFaction: state.setQuestFaction,
            setQuestShowKappa: state.setQuestShowKappa,
            setQuestShowLightkeeper: state.setQuestShowLightkeeper,
            setQuestSelectedMaps: state.setQuestSelectedMaps,
            setHideCompleted: state.setQuestHideCompleted,
            setShowAvailableOnly: state.setQuestShowAvailableOnly,
            setVisibilityMode: state.setQuestVisibilityMode,
            setActiveDepth: state.setQuestActiveDepth,
            setShowHandInOnly: state.setQuestShowHandInOnly,
            setShowFirHandInOnly: state.setQuestShowFirHandInOnly,
            setShowPinnedOnly: state.setQuestShowPinnedOnly,
            setShowIgnored: state.setQuestShowIgnored,
            setShowDebug: state.setQuestShowDebug,
            setShowPrereqs: state.setQuestShowPrereqs,
        })),
    );

    const selectedTraders = useMemo(() => new Set(questSelectedTraders), [questSelectedTraders]);
    const selectedMaps = useMemo(
        () => new Set(questSelectedMaps.map((map) => getQuestMapGroupKey(map))),
        [questSelectedMaps],
    );

    const syncProfile = useMemo(
        () => ({
            playerLevel,
            prestigeLevel,
            faction,
            traderLoyaltyLevels: questTraderLoyaltyLevels,
            completedQuests,
            failedQuests,
        }),
        [completedQuests, failedQuests, faction, playerLevel, prestigeLevel, questTraderLoyaltyLevels],
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

    const failureMap = useMemo(() => buildQuestFailureMap(quests), [quests]);

    const activeDepthQuestIds = useMemo(() => {
        if (visibilityMode !== "activeDepth") return null;

        const maxDepth = Math.max(0, Math.floor(activeDepth));
        const result = new Set<string>();
        const queue: { questId: string; depth: number }[] = [];

        for (const quest of quests) {
            if (!isQuestAvailableForProfile(quest, syncProfile, questsById)) continue;
            result.add(quest.id);
            queue.push({ questId: quest.id, depth: 0 });
        }

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current.depth >= maxDepth) continue;

            for (const nextQuestId of leadsToByQuestId.get(current.questId) ?? []) {
                if (result.has(nextQuestId)) continue;
                result.add(nextQuestId);
                queue.push({ questId: nextQuestId, depth: current.depth + 1 });
            }
        }

        return result;
    }, [activeDepth, leadsToByQuestId, quests, questsById, syncProfile, visibilityMode]);

    const isQuestDisabled = (questId: string) => {
        const quest = questsById.get(questId);
        return quest ? isQuestDisabledByCompletedFailedRequirement(quest, completedQuests) : false;
    };

    const traders = useMemo(() => {
        const map = new Map<string, FullQuest["trader"]>();
        for (const q of quests) {
            if (!map.has(q.trader.id)) map.set(q.trader.id, q.trader);
        }
        return [...map.values()].sort((a, b) => compareQuestTradersByOrder(a.name, b.name));
    }, [quests]);

    const allMaps = useMemo(
        () => buildQuestMapGroups(quests).map((group) => [group.key, group.name] as [string, string]),
        [quests],
    );

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

            const resolved =
                completedQuests[quest.id] ||
                failedQuests[quest.id] ||
                isQuestDisabledByCompletedFailedRequirement(quest, completedQuests);

            if (hideCompleted && resolved) return false;
            if (!showIgnored && ignoredQuests[quest.id]) return false;
            if (
                visibilityMode === "hideLocked" &&
                !isQuestAvailableForProfile(quest, syncProfile, questsById)
            )
                return false;
            if (visibilityMode === "activeDepth" && !activeDepthQuestIds?.has(quest.id)) return false;
            if (showPinnedOnly && !pinnedQuests[quest.id]) return false;
            if (showHandInOnly && !hasGiveItemObjectives(quest)) return false;
            if (showFirHandInOnly && !hasFirGiveItemObjectives(quest)) return false;
            if (selectedTraders.size > 0 && !selectedTraders.has(quest.trader.id)) return false;
            if (!matchesFactionVisibility(quest.factionName, faction)) return false;

            if (showKappa || showLightkeeper) {
                if (!((showKappa && kappaQuestIds.has(quest.id)) || (showLightkeeper && lightkeeperQuestIds.has(quest.id))))
                    return false;
            }

            if (!questMatchesSelectedMapGroups(quest, selectedMaps)) {
                return false;
            }

            return true;
        });
    }, [
        quests,
        searchQuery,
        hideCompleted,
        completedQuests,
        failedQuests,
        showIgnored,
        ignoredQuests,
        visibilityMode,
        activeDepthQuestIds,
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
        () => quests.filter((q) => !q.removed && completedQuests[q.id]).length,
        [quests, completedQuests],
    );

    const failedCount = useMemo(
        () => quests.filter((q) => !q.removed && failedQuests[q.id]).length,
        [quests, failedQuests],
    );

    const toggleTrader = (id: string) => {
        const next = new Set(questSelectedTraders);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setQuestSelectedTraders([...next]);
    };

    const clearTraders = () => setQuestSelectedTraders([]);
    const showOnlyTrader = (id: string) => setQuestSelectedTraders([id]);

    const toggleMap = (normalizedName: string) => {
        const groupKey = getQuestMapGroupKey(normalizedName);
        const isSelected = selectedMaps.has(groupKey);
        const next = questSelectedMaps.filter((map) => getQuestMapGroupKey(map) !== groupKey);

        if (!isSelected) next.push(groupKey);

        setQuestSelectedMaps(next);
    };

    const clearMaps = () => setQuestSelectedMaps([]);

    const toggleFaction = (nextFaction: FactionFilter) => setQuestFaction(faction === nextFaction ? null : nextFaction);
    const toggleKappa = () => setQuestShowKappa(!showKappa);
    const toggleLightkeeper = () => setQuestShowLightkeeper(!showLightkeeper);

    const getSyncCandidatesForTrader = (traderId: string) => getSyncCandidatesForTraderFromProfile(quests, traderId);

    const requestToggleQuestCompletion = (questId: string) => {
        const userState = useUserStore.getState();
        const isCurrentlyComplete = !!userState.completedQuests[questId];

        if (isCurrentlyComplete) {
            const cascade = collectUncompleteCascade(questId, {
                questsById,
                completedQuests: userState.completedQuests,
                leadsToByQuestId,
            });

            if (cascade.toUncomplete.length <= 1) {
                userState.applyQuestCompletionChange({ uncomplete: cascade.toUncomplete });
                return;
            }

            useUIStore.getState().openQuestCascadeRequest({
                mode: "uncomplete",
                rootQuestId: questId,
                questIds: cascade.toUncomplete,
                crossTraderQuestIds: cascade.crossTraderQuestIds,
                sensitiveQuestIds: [],
            });
            return;
        }

        const cascade = collectCompleteCascade(questId, {
            questsById,
            completedQuests: userState.completedQuests,
        });

        if (cascade.toComplete.length === 0) return;

        const autoFailedQuestIds = getAutoFailedQuestIds(
            cascade.toComplete,
            failureMap,
            userState.failedQuests,
        );
        const rootAutoFailedQuestIds = getAutoFailedQuestIds(
            [questId],
            failureMap,
            userState.failedQuests,
        );

        const shouldConfirm =
            cascade.crossTraderQuestIds.length > 0 ||
            cascade.toComplete.length > 10 ||
            cascade.sensitiveQuestIds.length > 0 ||
            autoFailedQuestIds.length > 0;

        if (!shouldConfirm) {
            userState.applyQuestCompletionChange({
                complete: cascade.toComplete,
                fail: autoFailedQuestIds,
            });
            return;
        }

        useUIStore.getState().openQuestCascadeRequest({
            mode: "complete",
            rootQuestId: questId,
            questIds: cascade.toComplete,
            autoFailedQuestIds,
            rootAutoFailedQuestIds,
            crossTraderQuestIds: cascade.crossTraderQuestIds,
            sensitiveQuestIds: cascade.sensitiveQuestIds,
        });
    };

    const requestFailQuest = (questId: string) => {
        const quest = questsById.get(questId);
        if (!quest || !questCanFail(quest)) return;
        useUserStore.getState().applyQuestFailureChange({ fail: [questId] });
    };

    const requestResetQuestStatus = (questId: string) => {
        const userState = useUserStore.getState();
        const isCurrentlyComplete = !!userState.completedQuests[questId];
        const isCurrentlyFailed = !!userState.failedQuests[questId];

        if (!isCurrentlyComplete && !isCurrentlyFailed) return;

        if (!isCurrentlyComplete) {
            userState.applyQuestFailureChange({ unFail: [questId] });
            return;
        }

        const cascade = collectUncompleteCascade(questId, {
            questsById,
            completedQuests: userState.completedQuests,
            leadsToByQuestId,
        });

        if (cascade.toUncomplete.length <= 1) {
            userState.applyQuestCompletionChange({
                uncomplete: cascade.toUncomplete,
                unFail: [questId],
            });
            return;
        }

        useUIStore.getState().openQuestCascadeRequest({
            mode: "uncomplete",
            rootQuestId: questId,
            questIds: cascade.toUncomplete,
            crossTraderQuestIds: cascade.crossTraderQuestIds,
            sensitiveQuestIds: [],
        });
    };

    const previewTraderSelection = (
        traderId: string,
        selectedQuestIds: string[],
        enableInference: boolean = true,
        allowedSensitiveBackfillQuestIds: string[] = [],
        deniedSensitiveBackfillQuestIds: string[] = [],
    ) => {
        const state = useUserStore.getState();
        return syncTraderProgress({
            quests,
            traderId,
            selectedQuestIds,
            enableInference,
            allowedSensitiveBackfillQuestIds,
            deniedSensitiveBackfillQuestIds,
            profile: buildSyncProfile(state),
            questsWithItems: state.questsWithItems,
        });
    };

    const syncTraderSelection = (
        traderId: string,
        selectedQuestIds: string[],
        enableInference: boolean = true,
        allowedSensitiveBackfillQuestIds: string[] = [],
        deniedSensitiveBackfillQuestIds: string[] = [],
    ) => {
        const result = previewTraderSelection(
            traderId,
            selectedQuestIds,
            enableInference,
            allowedSensitiveBackfillQuestIds,
            deniedSensitiveBackfillQuestIds,
        );

        if (result.completedIds.length > 0) {
            useUserStore.getState().applyQuestCompletionChange({
                complete: result.completedIds,
                fail: result.autoFailedQuestIds,
            });
        }

        const action = {
            ...result,
            traderName: quests.find((quest) => quest.trader.id === traderId)?.trader.name ?? "Trader",
        };
        if (result.completedIds.length > 0) {
            setLastQuestSyncAction(action);
        }
        return action;
    };

    const undoLastQuestSync = () => {
        if (!lastQuestSyncAction || lastQuestSyncAction.completedIds.length === 0) return false;

        const state = useUserStore.getState();
        const affectedQuestIds = [
            ...lastQuestSyncAction.completedIds,
            ...lastQuestSyncAction.autoFailedQuestIds,
        ];
        const complete = affectedQuestIds.filter(
            (questId) => !!lastQuestSyncAction.previousCompletedQuests[questId] && !state.completedQuests[questId],
        );
        const uncomplete = affectedQuestIds.filter(
            (questId) => !lastQuestSyncAction.previousCompletedQuests[questId] && !!state.completedQuests[questId],
        );
        state.applyQuestCompletionChange({ complete, uncomplete });

        const currentState = useUserStore.getState();
        {
            const failedQuests = { ...currentState.failedQuests };
            const questsWithItems = { ...currentState.questsWithItems };
            restoreRecordValues(failedQuests, lastQuestSyncAction.previousFailedQuests, affectedQuestIds);
            restoreRecordValues(questsWithItems, lastQuestSyncAction.previousQuestsWithItems, affectedQuestIds);
            currentState.applyProfilePatch({ failedQuests, questsWithItems });
        }

        setLastQuestSyncAction(null);
        return true;
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
                visibilityMode,
                activeDepth,
                showHandInOnly,
                showFirHandInOnly,
                showPinnedOnly,
                showIgnored,
                showDebug,
                showPrereqs,
                searchQuery,
                syncProfile,
                lastQuestSyncAction,
                filteredQuests,
                questsById,
                failureMap,
                kappaQuestIds,
                lightkeeperQuestIds,
                leadsToByQuestId,
                traders,
                allMaps,
                completedCount,
                failedCount,
                toggleTrader,
                showOnlyTrader,
                clearTraders,
                toggleMap,
                clearMaps,
                viewMode,
                sortMode,
                setViewMode,
                setSortMode,
                toggleFaction,
                toggleKappa,
                toggleLightkeeper,
                setHideCompleted,
                setShowAvailableOnly,
                setVisibilityMode,
                setActiveDepth,
                setShowHandInOnly,
                setShowFirHandInOnly,
                setShowPinnedOnly,
                setShowIgnored,
                setShowDebug,
                setShowPrereqs,
                setSearchQuery,
                getSyncCandidatesForTrader,
                requestToggleQuestCompletion,
                requestFailQuest,
                requestResetQuestStatus,
                isQuestDisabled,
                previewTraderSelection,
                syncTraderSelection,
                undoLastQuestSync,
                onItemClick: onItemClick ?? null,
                onQuestClick: onQuestClick ?? null,
            }}
        >
            {children}
        </QuestsContext.Provider>
    );
}

export { matchesFactionVisibility };
