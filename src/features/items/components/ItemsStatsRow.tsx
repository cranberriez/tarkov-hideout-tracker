"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useDataContext } from "@/app/(data)/_dataContext";
import { usePriceDataContext } from "@/app/(data)/_priceDataContext";
import { poolItems } from "@/lib/utils/item-pooling";
import type { QuestAnyOfGroupEntry, QuestItemIndexEntry } from "@/lib/utils/quest-item-index";
import { deriveQuestAnyOfGroups, deriveQuestItemStates } from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";

interface ItemsStatsRowProps {
    questItemIndex: QuestItemIndexEntry[];
    questAnyOfGroups: QuestAnyOfGroupEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
}

type MergedStatItem = {
    id: string;
    normalizedName?: string;
    hideoutCount: number;
    hideoutFirCount: number;
    questCount: number;
    questFirCount: number;
};

export function ItemsStatsRow({
    questItemIndex,
    questAnyOfGroups,
    questAvailabilityQuests,
}: ItemsStatsRowProps) {
    const { stations, items } = useDataContext();
    const { marketPricesByMode } = usePriceDataContext();
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
        prestigeLevel,
        questTraderLoyaltyLevels,
        questFaction,
        itemQuestVisibilityMode,
        itemQuestCustomLookahead,
        itemQuestCustomLevelLookahead,
        itemShowFutureFir,
        itemShowIgnored,
        questShowKappa,
        questShowLightkeeper,
        itemShowPinnedQuestOnly,
        itemSourceFilter,
        showFirOnly,
        hideCheap,
        cheapPriceThreshold,
        gameMode,
        itemCounts,
    } = useUserStore();

    const deriveOptions = useMemo(
        () => ({
            completedQuests,
            ignoredQuests,
            pinnedQuests,
            playerLevel,
            prestigeLevel,
            faction: questFaction,
            traderLoyaltyLevels: questTraderLoyaltyLevels,
            quests: questAvailabilityQuests,
            visibilityMode: itemQuestVisibilityMode,
            customLookahead: itemQuestCustomLookahead,
            customLevelLookahead: itemQuestCustomLevelLookahead,
            showFutureFir: itemShowFutureFir,
            showIgnored: itemShowIgnored,
            showKappa: questShowKappa,
            showLightkeeper: questShowLightkeeper,
        }),
        [
            completedQuests,
            ignoredQuests,
            pinnedQuests,
            playerLevel,
            prestigeLevel,
            questFaction,
            questTraderLoyaltyLevels,
            questAvailabilityQuests,
            itemQuestVisibilityMode,
            itemQuestCustomLookahead,
            itemQuestCustomLevelLookahead,
            itemShowFutureFir,
            itemShowIgnored,
            questShowKappa,
            questShowLightkeeper,
        ],
    );

    const activeQuestItems = useMemo(
        () => deriveQuestItemStates(questItemIndex, deriveOptions),
        [deriveOptions, questItemIndex],
    );
    const activeQuestGroups = useMemo(
        () => deriveQuestAnyOfGroups(questAnyOfGroups, deriveOptions),
        [deriveOptions, questAnyOfGroups],
    );

    const groupedQuestDeductionsByItemId = useMemo(() => {
        const deductions = new Map<string, { count: number; firCount: number }>();
        for (const group of activeQuestGroups) {
            for (const item of group.items) {
                const existing = deductions.get(item.id) ?? { count: 0, firCount: 0 };
                deductions.set(item.id, {
                    count: existing.count + group.requiredCount,
                    firCount: existing.firCount + group.requiredFirCount,
                });
            }
        }
        return deductions;
    }, [activeQuestGroups]);

    const mergedPool = useMemo(() => {
        if (!stations) return [];

        const normalizedNameByItemId = new Map<string, string>();
        for (const item of items ?? []) normalizedNameByItemId.set(item.id, item.normalizedName);
        for (const questItem of activeQuestItems) {
            normalizedNameByItemId.set(questItem.itemId, questItem.normalizedName);
        }

        const hideoutItems = poolItems({
            stations,
            stationLevels,
            hiddenStations,
            showHidden,
            viewMode: checklistViewMode,
            completedRequirements,
        });

        const merged = new Map<string, MergedStatItem>();
        for (const item of hideoutItems) {
            merged.set(item.id, {
                id: item.id,
                normalizedName: normalizedNameByItemId.get(item.id),
                hideoutCount: item.count,
                hideoutFirCount: item.firCount,
                questCount: 0,
                questFirCount: 0,
            });
        }

        for (const questItem of activeQuestItems) {
            const deduction = groupedQuestDeductionsByItemId.get(questItem.itemId);
            const questCount = Math.max(0, questItem.requiredCount - (deduction?.count ?? 0));
            const questFirCount = Math.max(
                0,
                questItem.requiredFirCount - (deduction?.firCount ?? 0),
            );
            const existing = merged.get(questItem.itemId);
            if (existing) {
                merged.set(questItem.itemId, { ...existing, questCount, questFirCount });
            } else if (questCount > 0 || questFirCount > 0) {
                merged.set(questItem.itemId, {
                    id: questItem.itemId,
                    normalizedName: questItem.normalizedName,
                    hideoutCount: 0,
                    hideoutFirCount: 0,
                    questCount,
                    questFirCount,
                });
            }
        }

        return Array.from(merged.values());
    }, [
        activeQuestItems,
        checklistViewMode,
        completedRequirements,
        groupedQuestDeductionsByItemId,
        hiddenStations,
        items,
        showHidden,
        stationLevels,
        stations,
    ]);

    const visibleQuestGroups = useMemo(() => {
        let groups = activeQuestGroups;
        if (itemSourceFilter === "hideout") groups = [];
        if (itemShowPinnedQuestOnly) groups = groups.filter((group) => group.isPinnedOverride);
        if (showFirOnly) groups = groups.filter((group) => group.requiredFirCount > 0);
        return groups;
    }, [activeQuestGroups, itemShowPinnedQuestOnly, itemSourceFilter, showFirOnly]);

    const mode = gameMode === "PVE" ? "PVE" : "PVP";
    const priceBucket = marketPricesByMode[mode];

    const stats = useMemo(() => {
        const visibleItems = mergedPool
            .map((item) => {
                const visibleQuestCount =
                    itemSourceFilter !== "hideout"
                        ? itemShowPinnedQuestOnly
                            ? 0
                            : item.questCount
                        : 0;
                const visibleQuestFirCount =
                    itemSourceFilter !== "hideout"
                        ? itemShowPinnedQuestOnly
                            ? 0
                            : item.questFirCount
                        : 0;
                const visibleHideoutCount = itemSourceFilter !== "quest" ? item.hideoutCount : 0;
                const visibleHideoutFirCount =
                    itemSourceFilter !== "quest" ? item.hideoutFirCount : 0;
                const visibleCount = visibleHideoutCount + visibleQuestCount;
                const visibleFirCount = visibleHideoutFirCount + visibleQuestFirCount;

                return {
                    ...item,
                    visibleCount,
                    visibleFirCount,
                    visibleHideout: visibleHideoutCount > 0,
                    visibleQuest: visibleQuestCount > 0,
                };
            })
            .filter((item) => item.visibleCount > 0)
            .filter((item) => !showFirOnly || item.visibleFirCount > 0)
            .filter((item) => {
                if (!hideCheap) return true;
                if (item.visibleFirCount > 0) return true;
                const normalizedName = item.normalizedName;
                if (
                    normalizedName === "roubles" ||
                    normalizedName === "dollars" ||
                    normalizedName === "euros"
                ) {
                    return true;
                }
                const marketPrice = normalizedName ? priceBucket?.prices[normalizedName] : undefined;
                const unitPrice = marketPrice?.avg24hPrice ?? marketPrice?.price;
                return unitPrice == null || unitPrice >= cheapPriceThreshold;
            });

        const completeItems = visibleItems.filter((item) => {
            const counts = itemCounts[item.id];
            if (!counts) return false;
            return counts.have + counts.haveFir >= item.visibleCount;
        }).length;

        return {
            total: visibleItems.length + visibleQuestGroups.length,
            hideout: visibleItems.filter((item) => item.visibleHideout).length,
            quest:
                visibleItems.filter((item) => item.visibleQuest).length + visibleQuestGroups.length,
            complete: completeItems,
        };
    }, [
        cheapPriceThreshold,
        hideCheap,
        itemCounts,
        itemShowPinnedQuestOnly,
        itemSourceFilter,
        mergedPool,
        priceBucket,
        showFirOnly,
        visibleQuestGroups.length,
    ]);

    return (
        <div className="my-1 flex items-center gap-2 px-1 text-xs select-none text-gray-600">
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
            <span className="tabular-nums font-medium text-gray-400">{value}</span>
            <span className="ml-1">{label}</span>
        </span>
    );
}

function Sep() {
    return <span className="text-gray-700">|</span>;
}
