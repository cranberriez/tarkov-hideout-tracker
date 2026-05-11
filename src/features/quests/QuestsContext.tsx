"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { FullQuest } from "@/types";

export type FactionFilter = "USEC" | "BEAR";

interface QuestsContextValue {
    quests: FullQuest[];

    selectedTraders: Set<string>;
    faction: FactionFilter | null;
    showKappa: boolean;
    showLightkeeper: boolean;
    selectedMaps: Set<string>;
    hideCompleted: boolean;
    showAvailableOnly: boolean;

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
    toggleFaction: (f: FactionFilter) => void;
    toggleKappa: () => void;
    toggleLightkeeper: () => void;
    setHideCompleted: (value: boolean) => void;
    setShowAvailableOnly: (value: boolean) => void;
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
    const { completedQuests, playerLevel } = useUserStore();

    const [selectedTraders, setSelectedTraders] = useState<Set<string>>(new Set());
    const [faction, setFaction] = useState<FactionFilter | null>(null);
    const [showKappa, setShowKappa] = useState(false);
    const [showLightkeeper, setShowLightkeeper] = useState(false);
    const [selectedMaps, setSelectedMaps] = useState<Set<string>>(new Set());
    const [hideCompleted, setHideCompleted] = useState(false);
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);

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
            if (hideCompleted && completedQuests[quest.id]) return false;

            if (showAvailableOnly) {
                if ((quest.minPlayerLevel ?? 0) > playerLevel) return false;
                if (!quest.taskRequirements.every((req) => completedQuests[req.task.id])) return false;
            }

            if (selectedTraders.size > 0 && !selectedTraders.has(quest.trader.id)) return false;
            if (faction !== null && quest.factionName && quest.factionName !== faction) return false;

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
        playerLevel,
        kappaQuestIds,
        lightkeeperQuestIds,
    ]);

    const completedCount = useMemo(
        () => quests.filter((q) => completedQuests[q.id]).length,
        [quests, completedQuests],
    );

    const toggleTrader = (id: string) =>
        setSelectedTraders((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const clearTraders = () => setSelectedTraders(new Set());

    const toggleMap = (normalizedName: string) =>
        setSelectedMaps((prev) => {
            const next = new Set(prev);
            if (next.has(normalizedName)) next.delete(normalizedName);
            else next.add(normalizedName);
            return next;
        });

    const clearMaps = () => setSelectedMaps(new Set());

    const toggleFaction = (f: FactionFilter) => setFaction((prev) => (prev === f ? null : f));
    const toggleKappa = () => setShowKappa((v) => !v);
    const toggleLightkeeper = () => setShowLightkeeper((v) => !v);

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
                toggleFaction,
                toggleKappa,
                toggleLightkeeper,
                setHideCompleted,
                setShowAvailableOnly,
            }}
        >
            {children}
        </QuestsContext.Provider>
    );
}
