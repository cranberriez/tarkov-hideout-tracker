"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useDataContext } from "@/app/(data)/_dataContext";
import { poolItems } from "@/lib/utils/item-pooling";
import type { PerQuestPool } from "@/lib/utils/quest-pooling";
import { mergePerQuestPools } from "@/lib/utils/quest-pooling";

interface ItemsStatsRowProps {
    perQuestPools: PerQuestPool[];
}

export function ItemsStatsRow({ perQuestPools }: ItemsStatsRowProps) {
    const { stations } = useDataContext();
    const {
        stationLevels,
        hiddenStations,
        checklistViewMode,
        showHidden,
        completedRequirements,
        completedQuests,
        itemCounts,
    } = useUserStore();

    const activeQuestItems = useMemo(
        () => mergePerQuestPools(perQuestPools, completedQuests),
        [perQuestPools, completedQuests],
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
            const existing = merged.get(qi.id);
            if (existing) {
                merged.set(qi.id, {
                    ...existing,
                    count: existing.count + qi.count,
                    firCount: existing.firCount + qi.firCount,
                    isQuest: true,
                });
            } else {
                merged.set(qi.id, {
                    id: qi.id,
                    count: qi.count,
                    firCount: qi.firCount,
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
        const hideout = mergedPool.filter((i) => i.isHideout).length;
        const quest = mergedPool.filter((i) => i.isQuest).length;
        const complete = mergedPool.filter((i) => {
            const counts = itemCounts[i.id];
            if (!counts) return false;
            return counts.have + counts.haveFir >= i.count;
        }).length;
        return { total, hideout, quest, complete };
    }, [mergedPool, itemCounts]);

    return (
        <div className="flex items-center gap-2 px-1 mt-2 text-xs text-gray-600 select-none">
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
            <span className="text-gray-400 font-medium tabular-nums">{value}</span>
            <span className="ml-1">{label}</span>
        </span>
    );
}

function Sep() {
    return <span className="text-gray-700">·</span>;
}
