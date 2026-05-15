"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemRow } from "./ItemRow";
import { poolItems } from "@/lib/utils/item-pooling";
import type { ItemDetails } from "@/types";
import type { DerivedQuestItemState, QuestItemIndexEntry } from "@/lib/utils/quest-item-index";
import { compareQuestItemState, deriveQuestItemStates } from "@/lib/utils/quest-item-index";
import { useDataContext } from "@/app/(data)/_dataContext";
import { usePriceDataContext } from "@/app/(data)/_priceDataContext";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";

interface ItemsListProps {
    onClickItem: (item: ItemDetails) => void;
    questItemIndex: QuestItemIndexEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
}

type MergedItem = {
    id: string;
    count: number;
    firCount: number;
    isTool: boolean;
    isHideout: boolean;
    isQuest: boolean;
    hideoutCount: number;
    hideoutFirCount: number;
    questCount: number;
    questFirCount: number;
    details?: ItemDetails;
    questState?: DerivedQuestItemState;
};

type DisplayItem = MergedItem & { details: ItemDetails };
type QuestSlice = "all" | "pinned" | "unpinned" | "none";

export function ItemsList({
    onClickItem,
    questItemIndex,
    questAvailabilityQuests,
}: ItemsListProps) {
    const { stations, items } = useDataContext();
    const { marketPricesByMode } = usePriceDataContext();

    const {
        stationLevels,
        hiddenStations,
        checklistViewMode,
        showHidden,
        hideCheap,
        cheapPriceThreshold,
        itemsSize,
        useCategorization,
        showFirOnly,
        itemSourceFilter,
        gameMode,
        completedRequirements,
        completedQuests,
        ignoredQuests,
        pinnedQuests,
        playerLevel,
        prestigeLevel,
        questTraderLoyaltyLevels,
        questFaction,
        itemShowPinnedQuestSection,
        itemShowPinnedQuestOnly,
        itemQuestMaxDepth,
    } = useUserStore();

    const itemsById = useMemo(() => {
        if (!items) return null;

        const map: Record<string, ItemDetails> = {};
        for (const item of items) {
            map[item.id] = item;
        }
        return map;
    }, [items]);

    const activeQuestStates = useMemo(
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
                maxDepth: itemQuestMaxDepth,
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
            itemQuestMaxDepth,
        ],
    );

    const questStateByItemId = useMemo(
        () => new Map(activeQuestStates.map((state) => [state.itemId, state])),
        [activeQuestStates],
    );

    const allItemDetails = useMemo(() => {
        const details: Record<string, ItemDetails> = { ...(itemsById ?? {}) };

        for (const entry of questItemIndex) {
            if (!details[entry.itemId]) {
                details[entry.itemId] = {
                    id: entry.itemId,
                    name: entry.name,
                    normalizedName: entry.normalizedName,
                    iconLink: entry.iconLink,
                    gridImageLink: entry.gridImageLink,
                };
            }
        }

        return details;
    }, [itemsById, questItemIndex]);

    const mode = gameMode === "PVE" ? "PVE" : "PVP";
    const priceBucket = marketPricesByMode[mode];

    const pooledHideoutItems = useMemo(() => {
        if (!stations) return [];

        return poolItems({
            stations,
            stationLevels,
            hiddenStations,
            showHidden,
            viewMode: checklistViewMode,
            completedRequirements,
        });
    }, [
        stations,
        stationLevels,
        hiddenStations,
        checklistViewMode,
        showHidden,
        completedRequirements,
    ]);

    const mergedPool = useMemo(() => {
        const merged = new Map<string, MergedItem>(
            pooledHideoutItems.map((item) => [
                item.id,
                {
                    ...item,
                    hideoutCount: item.count,
                    hideoutFirCount: item.firCount,
                    questCount: 0,
                    questFirCount: 0,
                    questState: questStateByItemId.get(item.id),
                },
            ]),
        );

        for (const questState of activeQuestStates) {
            const existing = merged.get(questState.itemId);
            if (existing) {
                merged.set(questState.itemId, {
                    ...existing,
                    count: existing.count + questState.requiredCount,
                    firCount: existing.firCount + questState.requiredFirCount,
                    questCount: questState.requiredCount,
                    questFirCount: questState.requiredFirCount,
                    isQuest: true,
                    questState,
                });
            } else {
                merged.set(questState.itemId, {
                    id: questState.itemId,
                    count: questState.requiredCount,
                    firCount: questState.requiredFirCount,
                    isTool: false,
                    isHideout: false,
                    isQuest: true,
                    hideoutCount: 0,
                    hideoutFirCount: 0,
                    questCount: questState.requiredCount,
                    questFirCount: questState.requiredFirCount,
                    details: allItemDetails[questState.itemId],
                    questState,
                });
            }
        }

        return Array.from(merged.values()).map((item) => ({
            ...item,
            details: allItemDetails[item.id],
            questState: item.questState ?? questStateByItemId.get(item.id),
        }));
    }, [pooledHideoutItems, activeQuestStates, allItemDetails, questStateByItemId]);

    const getPrice = (normalizedName: string) => priceBucket?.prices[normalizedName];

    const compareDisplayItems = (a: DisplayItem, b: DisplayItem) => {
        if (a.questState && b.questState) {
            const byQuest = compareQuestItemState(a.questState, b.questState);
            if (byQuest !== 0) return byQuest;
        } else if (a.questState || b.questState) {
            return a.questState ? -1 : 1;
        }

        return a.details.name.localeCompare(b.details.name);
    };

    const finalizeDisplayItems = (
        itemsToDisplay: Array<
            MergedItem & { details?: ItemDetails; questState?: DerivedQuestItemState }
        >,
    ): DisplayItem[] => {
        let finalItems = itemsToDisplay.filter((item): item is DisplayItem => !!item.details);

        if (showFirOnly) {
            finalItems = finalItems.filter((item) => (item.firCount || 0) > 0);
        }

        if (hideCheap) {
            finalItems = finalItems.filter((item) => {
                const norm = item.details.normalizedName;
                if (norm === "roubles" || norm === "dollars" || norm === "euros") {
                    return true;
                }

                const marketPrice = getPrice(norm);
                if (!marketPrice) return true;

                const unitPrice = marketPrice.avg24hPrice ?? marketPrice.price ?? undefined;
                if (unitPrice == null) return true;

                return unitPrice >= cheapPriceThreshold;
            });
        }

        finalItems.sort(compareDisplayItems);
        return finalItems;
    };

    const buildVisibleItems = (includeHideout: boolean, questSlice: QuestSlice) =>
        finalizeDisplayItems(
            mergedPool
                .map((item) => {
                    const pinnedQuestCount = item.questState?.pinnedRequiredCount ?? 0;
                    const pinnedQuestFirCount = item.questState?.pinnedRequiredFirCount ?? 0;
                    const visibleQuestCount =
                        questSlice === "none"
                            ? 0
                            : questSlice === "pinned"
                              ? pinnedQuestCount
                              : questSlice === "unpinned"
                                ? Math.max(item.questCount - pinnedQuestCount, 0)
                                : item.questCount;
                    const visibleQuestFirCount =
                        questSlice === "none"
                            ? 0
                            : questSlice === "pinned"
                              ? pinnedQuestFirCount
                              : questSlice === "unpinned"
                                ? Math.max(item.questFirCount - pinnedQuestFirCount, 0)
                                : item.questFirCount;
                    const hideoutCount = includeHideout ? item.hideoutCount : 0;
                    const hideoutFirCount = includeHideout ? item.hideoutFirCount : 0;
                    const count = hideoutCount + visibleQuestCount;
                    const firCount = hideoutFirCount + visibleQuestFirCount;

                    return {
                        ...item,
                        count,
                        firCount,
                        isHideout: includeHideout && item.isHideout,
                        isQuest: visibleQuestCount > 0,
                    };
                })
                .filter((item) => item.count > 0),
        );

    const sourceItems =
        itemSourceFilter === "hideout"
            ? buildVisibleItems(true, "none")
            : itemSourceFilter === "quest"
              ? buildVisibleItems(false, itemShowPinnedQuestOnly ? "pinned" : "all")
              : buildVisibleItems(true, itemShowPinnedQuestOnly ? "pinned" : "all");

    const pinnedSectionItems =
        !itemShowPinnedQuestSection || itemShowPinnedQuestOnly || itemSourceFilter === "hideout"
            ? []
            : buildVisibleItems(false, "pinned");

    const regularItems =
        itemShowPinnedQuestOnly || pinnedSectionItems.length === 0
            ? sourceItems
            : itemSourceFilter === "quest"
              ? buildVisibleItems(false, "unpinned")
              : buildVisibleItems(true, "unpinned");

    const gridClassesBySize: Record<string, string> = {
        Icon: "grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8",
        Compact: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        Expanded: "grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
    };
    const gridClasses = gridClassesBySize[itemsSize] ?? gridClassesBySize.Expanded;

    const renderItems = (itemsToRender: DisplayItem[]) => {
        if (!useCategorization) {
            return (
                <div className={`grid gap-2 ${gridClasses}`}>
                    {itemsToRender.map(({ id, count, firCount, isHideout, isQuest, details }) => (
                        <ItemRow
                            key={id}
                            item={details}
                            count={count}
                            firCount={firCount}
                            size={itemsSize}
                            isHideout={isHideout}
                            isQuest={isQuest}
                            onClick={() => onClickItem(details)}
                        />
                    ))}
                </div>
            );
        }

        const groups: Record<string, DisplayItem[]> = {};
        for (const item of itemsToRender) {
            const category = item.details.category?.name ?? "Other";
            if (!groups[category]) groups[category] = [];
            groups[category].push(item);
        }

        const sortedCategories = Object.keys(groups).sort((a, b) => {
            if (a === "Other") return 1;
            if (b === "Other") return -1;
            return a.localeCompare(b);
        });

        return (
            <div className="space-y-8">
                {sortedCategories.map((category) => (
                    <div key={category}>
                        <h2 className="mb-4 border-b border-white/10 pb-2 text-xl font-bold text-tarkov-green">
                            {category}{" "}
                            <span className="ml-2 text-sm font-normal text-gray-500">
                                ({groups[category].length})
                            </span>
                        </h2>
                        <div className={`grid gap-4 ${gridClasses}`}>
                            {groups[category].map(
                                ({ id, count, firCount, isHideout, isQuest, details }) => (
                                    <ItemRow
                                        key={id}
                                        item={details}
                                        count={count}
                                        firCount={firCount}
                                        size={itemsSize}
                                        isHideout={isHideout}
                                        isQuest={isQuest}
                                        onClick={() => onClickItem(details)}
                                    />
                                ),
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (!stations || !itemsById) {
        return null;
    }

    if (sourceItems.length === 0 && pinnedSectionItems.length === 0) {
        return (
            <div className="py-20 text-center text-gray-500">
                <div className="mb-2 text-xl">No items needed!</div>
                <div className="text-sm">
                    You might have maxed out your hideout, completed your visible quests, or
                    filtered everything out.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {pinnedSectionItems.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-sky-300">Pinned Quest Items</h2>
                        <span className="text-sm text-gray-500">({pinnedSectionItems.length})</span>
                    </div>
                    {renderItems(pinnedSectionItems)}
                </section>
            )}

            {regularItems.length > 0 && renderItems(regularItems)}
        </div>
    );
}
