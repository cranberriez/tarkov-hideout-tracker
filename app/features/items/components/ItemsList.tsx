"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataStore } from "@/app/lib/stores/useDataStore";
import { useUserStore } from "@/app/lib/stores/useUserStore";
import { ItemRow } from "./ItemRow";
import { poolItems } from "@/app/lib/utils/item-pooling";
import { ItemDetails } from "@/app/types";
import { ItemDetailModal } from "./ItemDetailModal";

export function ItemsList() {
    const {
        stations,
        fetchStations,
        items,
        fetchItems,
        loadingStations,
        loadingItems,
        errorStations,
        errorItems,
    } = useDataStore();

    const [selectedItem, setSelectedItem] = useState<ItemDetails | null>(null);

    const {
        stationLevels,
        hiddenStations,
        checklistViewMode,
        showHidden,
        hideCheap,
        cheapPriceThreshold,
        compactMode,
        initializeDefaults,
        sellToPreference,
        useCategorization,
    } = useUserStore();

    useEffect(() => {
        fetchStations();
        fetchItems();
    }, [fetchStations, fetchItems]);

    useEffect(() => {
        if (stations) {
            initializeDefaults(stations);
        }
    }, [stations, initializeDefaults]);

    const pooledItems = useMemo(() => {
        if (!stations) return [];

        return poolItems({
            stations,
            stationLevels,
            hiddenStations,
            showHidden,
            viewMode: checklistViewMode,
        });
    }, [stations, stationLevels, hiddenStations, checklistViewMode, showHidden]);

    const filteredAndSortedItems = useMemo(() => {
        if (!items) return [];

        let finalItems = pooledItems.map((pooled) => {
            const details = items[pooled.id];
            return {
                ...pooled,
                details,
            };
        });

        // Filter out items where we don't have details (shouldn't happen often)
        finalItems = finalItems.filter((i) => i.details);

        // Filter cheap items
        if (hideCheap) {
            finalItems = finalItems.filter((i) => {
                const price = i.details?.avg24hPrice ?? 0;
                return price >= cheapPriceThreshold;
            });
        }

        // Sort alphabetically by name (default sort)
        finalItems.sort((a, b) => {
            const nameA = a.details?.name ?? "";
            const nameB = b.details?.name ?? "";
            return nameA.localeCompare(nameB);
        });

        return finalItems;
    }, [pooledItems, items, hideCheap, cheapPriceThreshold]);

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

    if (loadingStations || loadingItems) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tarkov-green"></div>
            </div>
        );
    }

    if (errorStations || errorItems) {
        return (
            <div className="text-center text-red-500 py-10">
                Error: {errorStations || errorItems}
            </div>
        );
    }

    if (!stations || !items) {
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
    const gridClasses = compactMode
        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

    if (useCategorization && categorizedItems) {
        return (
            <>
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
                                                compact={compactMode}
                                                sellToPreference={sellToPreference}
                                                onClick={() => setSelectedItem(details)}
                                            />
                                        )
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <ItemDetailModal
                    item={selectedItem}
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    stations={stations}
                />
            </>
        );
    }

    return (
        <>
            <div className={`grid gap-4 ${gridClasses}`}>
                {filteredAndSortedItems.map(
                    ({ id, count, firCount, details }) =>
                        details && (
                            <ItemRow
                                key={id}
                                item={details}
                                count={count}
                                firCount={firCount}
                                compact={compactMode}
                                sellToPreference={sellToPreference}
                                onClick={() => setSelectedItem(details)}
                            />
                        )
                )}
            </div>
            <ItemDetailModal
                item={selectedItem}
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                stations={stations}
            />
        </>
    );
}
