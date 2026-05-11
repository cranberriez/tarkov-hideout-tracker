"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemRow } from "./ItemRow";
import { poolItems } from "@/lib/utils/item-pooling";
import type { ItemDetails } from "@/types";
import type { PerQuestPool } from "@/lib/utils/quest-pooling";
import { mergePerQuestPools } from "@/lib/utils/quest-pooling";
import { useDataContext } from "@/app/(data)/_dataContext";
import { usePriceDataContext } from "@/app/(data)/_priceDataContext";

interface ItemsListProps {
    onClickItem: (item: ItemDetails) => void;
    perQuestPools: PerQuestPool[];
}

export function ItemsList({ onClickItem, perQuestPools }: ItemsListProps) {
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
        sellToPreference,
        useCategorization,
        showFirOnly,
        itemSourceFilter,
        gameMode,
        completedRequirements,
        completedQuests,
    } = useUserStore();

    const itemsById = useMemo(() => {
        if (!items) return null;
        const map: Record<string, ItemDetails> = {};
        items.forEach((item) => {
            map[item.id] = item;
        });
        return map;
    }, [items]);

    const activeQuestItems = useMemo(
        () => mergePerQuestPools(perQuestPools, completedQuests),
        [perQuestPools, completedQuests],
    );

    // Build a lookup of ItemDetails that covers both hideout items and quest-only items.
    // Quest-only items use the basic metadata from the quest pool (no category/wiki).
    const allItemDetails = useMemo(() => {
        const details: Record<string, ItemDetails> = { ...(itemsById ?? {}) };
        for (const qi of activeQuestItems) {
            if (!details[qi.id]) {
                details[qi.id] = {
                    id: qi.id,
                    name: qi.name,
                    normalizedName: qi.normalizedName,
                    iconLink: qi.iconLink,
                    gridImageLink: qi.gridImageLink,
                };
            }
        }
        return details;
    }, [itemsById, activeQuestItems]);

    const mode = gameMode === "PVE" ? "PVE" : "PVP";
    const priceBucket = marketPricesByMode[mode];

    const getPrice = (normalizedName: string) => priceBucket?.prices[normalizedName];

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

    // Merge hideout pool with quest pool.
    // Items in both get combined counts and both source flags set.
    // Quest-only items get isHideout: false, isQuest: true.
    const mergedPool = useMemo(() => {
        const merged = new Map(pooledHideoutItems.map((item) => [item.id, { ...item }]));

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
    }, [pooledHideoutItems, activeQuestItems]);

    const filteredAndSortedItems = useMemo(() => {
        let finalItems = mergedPool
            .map((pooled) => ({
                ...pooled,
                details: allItemDetails[pooled.id],
            }))
            .filter((i) => i.details);

        if (itemSourceFilter === "hideout") {
            finalItems = finalItems.filter((i) => i.isHideout);
        } else if (itemSourceFilter === "quest") {
            finalItems = finalItems.filter((i) => i.isQuest);
        }

        if (showFirOnly) {
            finalItems = finalItems.filter((i) => (i.firCount || 0) > 0);
        }

        if (hideCheap) {
            finalItems = finalItems.filter((i) => {
                if (!i.details) return false;

                const norm = i.details.normalizedName;
                if (norm === "roubles" || norm === "dollars" || norm === "euros") {
                    return true;
                }

                const marketPrice = getPrice(i.details.normalizedName);
                if (!marketPrice) return true;

                const unitPrice = marketPrice.avg24hPrice ?? marketPrice.price ?? undefined;
                if (unitPrice == null) return true;

                return unitPrice >= cheapPriceThreshold;
            });
        }

        finalItems.sort((a, b) => {
            const nameA = a.details?.name ?? "";
            const nameB = b.details?.name ?? "";
            return nameA.localeCompare(nameB);
        });

        return finalItems;
    }, [mergedPool, allItemDetails, hideCheap, cheapPriceThreshold, showFirOnly, itemSourceFilter, getPrice]);

    const categorizedItems = useMemo(() => {
        if (!useCategorization) return null;

        const groups: Record<string, typeof filteredAndSortedItems> = {};

        filteredAndSortedItems.forEach((item) => {
            const category = item.details?.category?.name ?? "Other";
            if (!groups[category]) groups[category] = [];
            groups[category].push(item);
        });

        const sortedCategories = Object.keys(groups).sort((a, b) => {
            if (a === "Other") return 1;
            if (b === "Other") return -1;
            return a.localeCompare(b);
        });

        return sortedCategories.map((category) => ({
            category,
            items: groups[category],
        }));
    }, [filteredAndSortedItems, useCategorization]);

    if (!stations || !itemsById) {
        return null;
    }

    if (filteredAndSortedItems.length === 0) {
        return (
            <div className="text-center text-gray-500 py-20">
                <div className="text-xl mb-2">No items needed!</div>
                <div className="text-sm">
                    You might have maxed out your hideout or hidden all stations.
                </div>
            </div>
        );
    }

    const gridClassesBySize: Record<string, string> = {
        Icon: "grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8",
        Compact: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        Expanded: "grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
    };
    const gridClasses = gridClassesBySize[itemsSize] ?? gridClassesBySize.Expanded;

    if (useCategorization && categorizedItems) {
        return (
            <div className="space-y-8">
                {categorizedItems.map(({ category, items }) => (
                    <div key={category}>
                        <h2 className="text-xl font-bold text-tarkov-green mb-4 border-b border-white/10 pb-2">
                            {category}{" "}
                            <span className="text-sm font-normal text-gray-500 ml-2">
                                ({items.length})
                            </span>
                        </h2>
                        <div className={`grid gap-4 ${gridClasses}`}>
                            {items.map(
                                ({ id, count, firCount, isHideout, isQuest, details }) =>
                                    details && (
                                        <ItemRow
                                            key={id}
                                            item={details}
                                            count={count}
                                            firCount={firCount}
                                            size={itemsSize}
                                            sellToPreference={sellToPreference}
                                            isHideout={isHideout}
                                            isQuest={isQuest}
                                            onClick={() => onClickItem(details)}
                                        />
                                    )
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className={`grid gap-2 ${gridClasses}`}>
            {filteredAndSortedItems.map(
                ({ id, count, firCount, isHideout, isQuest, details }) =>
                    details && (
                        <ItemRow
                            key={id}
                            item={details}
                            count={count}
                            firCount={firCount}
                            size={itemsSize}
                            sellToPreference={sellToPreference}
                            isHideout={isHideout}
                            isQuest={isQuest}
                            onClick={() => onClickItem(details)}
                        />
                    )
            )}
        </div>
    );
}
