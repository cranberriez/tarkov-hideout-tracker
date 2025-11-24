"use client";

import { useEffect, useMemo } from "react";
import { useDataStore } from "@/app/lib/stores/useDataStore";
import { useUserStore } from "@/app/lib/stores/useUserStore";
import { ItemRow } from "./ItemRow";
import { poolItems } from "@/app/lib/utils/item-pooling";

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

    const {
        stationLevels,
        hiddenStations,
        checklistViewMode,
        showHidden,
        hideCheap,
        cheapPriceThreshold,
        compactMode,
        initializeDefaults,
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

        // Sort alphabetically by name
        finalItems.sort((a, b) => {
            const nameA = a.details?.name ?? "";
            const nameB = b.details?.name ?? "";
            return nameA.localeCompare(nameB);
        });

        return finalItems;
    }, [pooledItems, items, hideCheap, cheapPriceThreshold]);

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

    // Grid layout is now always a grid, just different densities for compact vs large
    const gridClasses = compactMode
        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

    return (
        <div className={`grid gap-4 ${gridClasses}`}>
            {filteredAndSortedItems.map(
                ({ id, count, details }) =>
                    details && (
                        <ItemRow key={id} item={details} count={count} compact={compactMode} />
                    )
            )}
        </div>
    );
}
