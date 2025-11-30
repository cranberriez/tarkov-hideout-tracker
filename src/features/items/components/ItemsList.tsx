"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemRow } from "./ItemRow";
import { poolItems } from "@/lib/utils/item-pooling";
import { ItemDetails } from "@/types";
import { useDataContext } from "@/app/(data)/_dataContext";

interface ItemsListProps {
    onClickItem: (item: ItemDetails) => void;
}

export function ItemsList({ onClickItem }: ItemsListProps) {
    const { stations, items, marketPricesByMode } = useDataContext();

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
        gameMode,
        completedRequirements,
    } = useUserStore();

    const itemsById = useMemo(() => {
        if (!items) return null;
        const map: Record<string, ItemDetails> = {};
        items.forEach((item) => {
            map[item.id] = item;
        });
        return map;
    }, [items]);

    const mode = gameMode === "PVE" ? "PVE" : "PVP";
    const priceBucket = marketPricesByMode[mode];

    const getPrice = (normalizedName: string) => priceBucket?.prices[normalizedName];

    const pooledItems = useMemo(() => {
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

    const filteredAndSortedItems = useMemo(() => {
        if (!itemsById) return [];

        let finalItems = pooledItems.map((pooled) => {
            const details = itemsById[pooled.id];
            return {
                ...pooled,
                details,
            };
        });

        // Filter out items where we don't have details (shouldn't happen often)
        finalItems = finalItems.filter((i) => i.details);

        // Filter FiR Only
        if (showFirOnly) {
            finalItems = finalItems.filter((i) => (i.firCount || 0) > 0);
        }

        // Filter cheap items
        if (hideCheap) {
            finalItems = finalItems.filter((i) => {
                if (!i.details) return false;

                const norm = i.details.normalizedName;
                if (norm === "roubles" || norm === "dollars" || norm === "euros") {
                    return true;
                }

                const marketPrice = getPrice(i.details.normalizedName);

                // If we don't have any price data yet, treat the item as "unknown" rather than cheap,
                // so we keep it visible until real market data is available.
                if (!marketPrice) return true;

                const unitPrice = marketPrice.avg24hPrice ?? marketPrice.price ?? undefined;

                // Again, if we still can't derive a concrete unitPrice, don't hide the item.
                if (unitPrice == null) return true;

                return unitPrice >= cheapPriceThreshold;
            });
        }

        // Sort alphabetically by name (default sort)
        finalItems.sort((a, b) => {
            const nameA = a.details?.name ?? "";
            const nameB = b.details?.name ?? "";
            return nameA.localeCompare(nameB);
        });

        return finalItems;
    }, [pooledItems, itemsById, hideCheap, cheapPriceThreshold, showFirOnly, getPrice]);

    const categorizedItems = useMemo(() => {
        if (!useCategorization) return null;

        const groups: Record<string, typeof filteredAndSortedItems> = {};

        filteredAndSortedItems.forEach((item) => {
            // Use category name, or "Other"
            const category = item.details?.category?.name ?? "Other";

            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(item);
        });

        // Sort categories alphabetically, but put "Other" last
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

    // Updated grid classes: 1 column on mobile/narrow, then expanding
    // Previously: grid-cols-2 on base
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
                                ({ id, count, firCount, details }) =>
                                    details && (
                                        <ItemRow
                                            key={id}
                                            item={details}
                                            count={count}
                                            firCount={firCount}
                                            size={itemsSize}
                                            sellToPreference={sellToPreference}
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
                ({ id, count, firCount, details }) =>
                    details && (
                        <ItemRow
                            key={id}
                            item={details}
                            count={count}
                            firCount={firCount}
                            size={itemsSize}
                            sellToPreference={sellToPreference}
                            onClick={() => onClickItem(details)}
                        />
                    )
            )}
        </div>
    );
}
