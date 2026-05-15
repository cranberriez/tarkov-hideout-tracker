"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useDataContext } from "@/app/(data)/_dataContext";
import { usePriceDataContext } from "@/app/(data)/_priceDataContext";
import { poolItems } from "@/lib/utils/item-pooling";
import type { QuestItemIndexEntry } from "@/lib/utils/quest-item-index";
import { deriveQuestItemStates } from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";

interface ItemsStatsRowProps {
    questItemIndex: QuestItemIndexEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
}

type MergedStatItem = {
    id: string;
    normalizedName?: string;
    isHideout: boolean;
    hideoutCount: number;
    hideoutFirCount: number;
    questCount: number;
    questFirCount: number;
};

export function ItemsStatsRow({ questItemIndex, questAvailabilityQuests }: ItemsStatsRowProps) {
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

    const activeQuestItems = useMemo(
        () =>
            deriveQuestItemStates(questItemIndex, {
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
            questItemIndex,
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

    const mergedPool = useMemo(() => {
        if (!stations) return [];

        const normalizedNameByItemId = new Map<string, string>();
        for (const item of items ?? []) {
            normalizedNameByItemId.set(item.id, item.normalizedName);
        }
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
                isHideout: item.isHideout,
                hideoutCount: item.count,
                hideoutFirCount: item.firCount,
                questCount: 0,
                questFirCount: 0,
            });
        }

        for (const questItem of activeQuestItems) {
            const existing = merged.get(questItem.itemId);
            if (existing) {
                merged.set(questItem.itemId, {
                    ...existing,
                    questCount: questItem.requiredCount,
                    questFirCount: questItem.requiredFirCount,
                });
                continue;
            }

            merged.set(questItem.itemId, {
                id: questItem.itemId,
                normalizedName: questItem.normalizedName,
                isHideout: false,
                hideoutCount: 0,
                hideoutFirCount: 0,
                questCount: questItem.requiredCount,
                questFirCount: questItem.requiredFirCount,
            });
        }

        return Array.from(merged.values());
    }, [
        activeQuestItems,
        checklistViewMode,
        completedRequirements,
        hiddenStations,
        items,
        showHidden,
        stationLevels,
        stations,
    ]);

    const mode = gameMode === "PVE" ? "PVE" : "PVP";
    const priceBucket = marketPricesByMode[mode];

    const stats = useMemo(() => {
        const questStateByItemId = new Map(activeQuestItems.map((item) => [item.itemId, item]));

        const visibleItems = mergedPool
            .map((item) => {
                const questState = questStateByItemId.get(item.id);
                const visibleQuestCount = itemShowPinnedQuestOnly
                    ? (questState?.pinnedRequiredCount ?? 0)
                    : item.questCount;
                const visibleQuestFirCount = itemShowPinnedQuestOnly
                    ? (questState?.pinnedRequiredFirCount ?? 0)
                    : item.questFirCount;
                const visibleHideoutCount = itemSourceFilter !== "quest" ? item.hideoutCount : 0;
                const visibleHideoutFirCount =
                    itemSourceFilter !== "quest" ? item.hideoutFirCount : 0;
                const visibleCount =
                    visibleHideoutCount + (itemSourceFilter !== "hideout" ? visibleQuestCount : 0);
                const visibleFirCount =
                    visibleHideoutFirCount +
                    (itemSourceFilter !== "hideout" ? visibleQuestFirCount : 0);

                return {
                    ...item,
                    visibleCount,
                    visibleFirCount,
                    visibleHideout: visibleHideoutCount > 0,
                    visibleQuest: itemSourceFilter !== "hideout" && visibleQuestCount > 0,
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

                const marketPrice = normalizedName
                    ? priceBucket?.prices[normalizedName]
                    : undefined;
                const unitPrice = marketPrice?.avg24hPrice ?? marketPrice?.price;
                return unitPrice == null || unitPrice >= cheapPriceThreshold;
            });

        return {
            total: visibleItems.length,
            hideout: visibleItems.filter((item) => item.visibleHideout).length,
            quest: visibleItems.filter((item) => item.visibleQuest).length,
            complete: visibleItems.filter((item) => {
                const counts = itemCounts[item.id];
                if (!counts) return false;
                return counts.have + counts.haveFir >= item.visibleCount;
            }).length,
        };
    }, [
        activeQuestItems,
        cheapPriceThreshold,
        hideCheap,
        itemCounts,
        itemShowPinnedQuestOnly,
        itemSourceFilter,
        mergedPool,
        priceBucket,
        showFirOnly,
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
