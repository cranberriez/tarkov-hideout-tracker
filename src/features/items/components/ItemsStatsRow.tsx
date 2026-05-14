"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useDataContext } from "@/app/(data)/_dataContext";
import { poolItems } from "@/lib/utils/item-pooling";
import type { QuestItemIndexEntry } from "@/lib/utils/quest-item-index";
import { deriveQuestItemStates } from "@/lib/utils/quest-item-index";

interface ItemsStatsRowProps {
    questItemIndex: QuestItemIndexEntry[];
}

export function ItemsStatsRow({ questItemIndex }: ItemsStatsRowProps) {
    const { stations } = useDataContext();
    const {
        stationLevels,
        hiddenStations,
        checklistViewMode,
        showHidden,
        completedRequirements,
        completedQuests,
        ignoredQuests,
        pinnedQuests,
        playerLevel,
        itemCounts,
    } = useUserStore();

    const activeQuestItems = useMemo(
        () =>
            deriveQuestItemStates(questItemIndex, {
                completedQuests,
                ignoredQuests,
                pinnedQuests,
                playerLevel,
            }),
        [questItemIndex, completedQuests, ignoredQuests, pinnedQuests, playerLevel],
    );

    const mergedPool = useMemo(() => {
        if (!stations) return [];

        const hideoutItems = poolItems({
            stations,
            stationLevels,
            hiddenStations,
            showHidden,
            viewMode: checklistViewMode,
            completedRequirements,
        });

        const merged = new Map(hideoutItems.map((item) => [item.id, { ...item }]));

        for (const qi of activeQuestItems) {
            const existing = merged.get(qi.itemId);
            if (existing) {
                merged.set(qi.itemId, {
                    ...existing,
                    count: existing.count + qi.requiredCount,
                    firCount: existing.firCount + qi.requiredFirCount,
                    isQuest: true,
                });
            } else {
                merged.set(qi.itemId, {
                    id: qi.itemId,
                    count: qi.requiredCount,
                    firCount: qi.requiredFirCount,
                    isTool: false,
                    isHideout: false,
                    isQuest: true,
                });
            }
        }

        return Array.from(merged.values());
    }, [
        stations,
        stationLevels,
        hiddenStations,
        checklistViewMode,
        showHidden,
        completedRequirements,
        activeQuestItems,
    ]);

    const stats = useMemo(() => {
        const total = mergedPool.length;
        const hideout = mergedPool.filter((item) => item.isHideout).length;
        const quest = mergedPool.filter((item) => item.isQuest).length;
        const complete = mergedPool.filter((item) => {
            const counts = itemCounts[item.id];
            if (!counts) return false;
            return counts.have + counts.haveFir >= item.count;
        }).length;

        return { total, hideout, quest, complete };
    }, [mergedPool, itemCounts]);

    return (
        <div className="mt-2 flex items-center gap-2 px-1 text-xs text-gray-600 select-none">
            <Stat value={stats.total} label="items" />
            <Sep />
            <Stat value={stats.hideout} label="hideout" />
            <Sep />
            <Stat value={stats.quest} label="quest" />
            <Sep />
            <Stat value={stats.complete} label="no longer needed" />
        </div>
    );
}

function Stat({ value, label }: { value: number; label: string }) {
    return (
        <span>
            <span className="font-medium text-gray-400 tabular-nums">{value}</span>
            <span className="ml-1">{label}</span>
        </span>
    );
}

function Sep() {
    return <span className="text-gray-700">·</span>;
}
