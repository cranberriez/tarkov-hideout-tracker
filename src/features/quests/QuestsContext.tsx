"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { FullQuest } from "@/types";
import { hasFirGiveItemObjectives, hasGiveItemObjectives } from "@/lib/utils/quest-item-index";

export type FactionFilter = "USEC" | "BEAR";

export function matchesFactionVisibility(
    questFaction: string | null | undefined,
    selectedFaction: FactionFilter | null,
) {
    if (selectedFaction === null) return true;
    if (selectedFaction === "USEC") return questFaction !== "BEAR";
    return questFaction !== "USEC";
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

    filteredQuests: FullQuest[];
    questsById: Map<string, FullQuest>;
    kappaQuestIds: Set<string>;
    lightkeeperQuestIds: Set<string>;
    leadsToByQuestId: Map<string, string[]>;
    traders: FullQuest["trader"][];
    allMaps: [string, string][];
    completedCount: number;
    lastPrereqSyncSummary: { questName: string; completedCount: number } | null;

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
    completePrerequisitesForQuest: (questId: string) => { completedIds: string[]; completedCount: number };
    undoLastPrerequisiteSync: () => boolean;
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

export function QuestsProvider({ quests, children }: { quests: FullQuest[]; children: ReactNode }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [lastPrereqSync, setLastPrereqSync] = useState<{
        questId: string;
        questName: string;
        completedIds: string[];
        previousCompleted: Record<string, boolean | undefined>;
        previousHaveItems: Record<string, boolean | undefined>;
    } | null>(null);
    const {
        completedQuests,
        ignoredQuests,
        playerLevel,
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
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
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

            if (showAvailableOnly) {
                if ((quest.minPlayerLevel ?? 0) > playerLevel) return false;
                if (!quest.taskRequirements.every((req) => completedQuests[req.task.id])) return false;
            }

            if (showPinnedOnly && !pinnedQuests[quest.id]) return false;
            if (showHandInOnly && !hasGiveItemObjectives(quest)) return false;
            if (showFirHandInOnly && !hasFirGiveItemObjectives(quest)) return false;

            if (selectedTraders.size > 0 && !selectedTraders.has(quest.trader.id)) return false;
            if (!matchesFactionVisibility(quest.factionName, faction)) return false;

            if (showKappa || showLightkeeper) {
                if (!((showKappa && kappaQuestIds.has(quest.id)) || (showLightkeeper && lightkeeperQuestIds.has(quest.id))))
                    return false;
            }

            if (selectedMaps.size > 0 && (!quest.map || !selectedMaps.has(quest.map.normalizedName)))
                return false;

            return true;
        });
    }, [
        quests,
        hideCompleted,
        showAvailableOnly,
        selectedTraders,
        faction,
        showKappa,
        showLightkeeper,
        selectedMaps,
        completedQuests,
        ignoredQuests,
        playerLevel,
        pinnedQuests,
        kappaQuestIds,
        lightkeeperQuestIds,
        showHandInOnly,
        showFirHandInOnly,
        showPinnedOnly,
        showIgnored,
        searchQuery,
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

    const toggleFaction = (f: FactionFilter) => setQuestFaction(faction === f ? null : f);
    const toggleKappa = () => setQuestShowKappa(!showKappa);
    const toggleLightkeeper = () => setQuestShowLightkeeper(!showLightkeeper);
    const completePrerequisitesForQuest = (questId: string) => {
        const ids = getTransitivePrereqs(new Set([questId]), questsById);
        ids.delete(questId);
        const state = useUserStore.getState();
        const completedIds = [...ids].filter((id) => !state.completedQuests[id]);
        const questName = questsById.get(questId)?.name ?? "Selected quest";

        if (completedIds.length === 0) {
            setLastPrereqSync({
                questId,
                questName,
                completedIds: [],
                previousCompleted: {},
                previousHaveItems: {},
            });
            return { completedIds, completedCount: 0 };
        }

        const previousCompleted = Object.fromEntries(
            completedIds.map((id) => [id, state.completedQuests[id]]),
        );
        const previousHaveItems = Object.fromEntries(
            completedIds.map((id) => [id, state.questsWithItems[id]]),
        );

        useUserStore.setState((current) => ({
            completedQuests: {
                ...current.completedQuests,
                ...Object.fromEntries(completedIds.map((id) => [id, true])),
            },
            questsWithItems: {
                ...current.questsWithItems,
                ...Object.fromEntries(completedIds.map((id) => [id, false])),
            },
        }));

        setLastPrereqSync({
            questId,
            questName,
            completedIds,
            previousCompleted,
            previousHaveItems,
        });

        return { completedIds, completedCount: completedIds.length };
    };

    const undoLastPrerequisiteSync = () => {
        if (!lastPrereqSync || lastPrereqSync.completedIds.length === 0) return false;

        useUserStore.setState((state) => {
            const completedQuests = { ...state.completedQuests };
            const questsWithItems = { ...state.questsWithItems };

            for (const id of lastPrereqSync.completedIds) {
                const prevCompleted = lastPrereqSync.previousCompleted[id];
                const prevHaveItems = lastPrereqSync.previousHaveItems[id];

                if (prevCompleted === undefined) delete completedQuests[id];
                else completedQuests[id] = prevCompleted;

                if (prevHaveItems === undefined) delete questsWithItems[id];
                else questsWithItems[id] = prevHaveItems;
            }

            return { completedQuests, questsWithItems };
        });

        setLastPrereqSync(null);
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
                showHandInOnly,
                showFirHandInOnly,
                showPinnedOnly,
                showIgnored,
                showDebug,
                searchQuery,
                filteredQuests,
                questsById,
                kappaQuestIds,
                lightkeeperQuestIds,
                leadsToByQuestId,
                traders,
                allMaps,
                completedCount,
                lastPrereqSyncSummary: lastPrereqSync
                    ? {
                          questName: lastPrereqSync.questName,
                          completedCount: lastPrereqSync.completedIds.length,
                      }
                    : null,
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
                completePrerequisitesForQuest,
                undoLastPrerequisiteSync,
            }}
        >
            {children}
        </QuestsContext.Provider>
    );
}
