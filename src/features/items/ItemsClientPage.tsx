"use client";

import { useEffect, useMemo, useState } from "react";
import type { ItemDetails } from "@/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemsList } from "@/features/items/components/ItemsList";
import { ItemsControls } from "@/features/items/components/ItemsControls";
import { ItemsStatsRow } from "@/features/items/components/ItemsStatsRow";
import { ItemSearchModal } from "@/features/items/components/ItemSearchModal";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";
import { DataLastUpdated } from "@/components/computed/DataLastUpdated";
import { useDataContext } from "@/app/(data)/_dataContext";
import type { QuestItemIndexEntry } from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";

interface ItemsClientPageProps {
    questItemIndex: QuestItemIndexEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
}

export function ItemsClientPage({ questItemIndex, questAvailabilityQuests }: ItemsClientPageProps) {
    const { stations, stationsUpdatedAt, items, itemsUpdatedAt } = useDataContext();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ItemDetails | null>(null);

    const {
        stationLevels,
        hiddenStations,
        completedRequirements,
        gameMode,
        setGameMode,
        initializeDefaults,
    } = useUserStore();

    useEffect(() => {
        if (stations && stations.length > 0) {
            initializeDefaults(stations);
        }
    }, [stations, stationsUpdatedAt, initializeDefaults]);

    useEffect(() => {
        if (items && items.length > 0) {
            const itemsMap: Record<string, ItemDetails> = {};
            items.forEach((item) => {
                itemsMap[item.id] = item;
            });
        }
    }, [items, itemsUpdatedAt]);

    const questAvailabilityQuestList = useMemo(() => questAvailabilityQuests, [questAvailabilityQuests]);

    // Merged pool: hideout items + any quest-only items not already present
    const allSearchableItems = useMemo(() => {
        const pool: Record<string, ItemDetails> = {};
        for (const item of (items ?? [])) {
            pool[item.id] = item;
        }
        for (const entry of questItemIndex) {
            if (!pool[entry.itemId]) {
                pool[entry.itemId] = {
                    id: entry.itemId,
                    name: entry.name,
                    normalizedName: entry.normalizedName,
                    iconLink: entry.iconLink,
                    gridImageLink: entry.gridImageLink,
                };
            }
        }
        return Object.values(pool);
    }, [items, questItemIndex]);

    return (
        <main className="container mx-auto px-6 py-8">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        ITEM CHECKLIST
                    </h1>
                    <p className="text-gray-400 mt-2 text-sm">
                        Aggregated hideout and quest hand-in items, ordered around live progression
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setGameMode(gameMode === "PVP" ? "PVE" : "PVP")}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border text-xs font-semibold font-mono cursor-pointer tracking-wide transition-all shadow-md
                        ${
                            gameMode === "PVP"
                                ? "border-red-500/70 bg-red-900/60 text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.45)]"
                                : "border-sky-400/80 bg-sky-900/70 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.7)]"
                        }
                    `}
                    title="Click to switch between PVP and PVE prices"
                >
                    <span>{gameMode}</span>
                </button>
            </div>

            <div className="mb-8">
                <ItemsControls onOpenSearch={() => setIsSearchOpen(true)} />
                <ItemsStatsRow
                    questItemIndex={questItemIndex}
                    questAvailabilityQuests={questAvailabilityQuestList}
                />
            </div>

            <ItemsList
                onClickItem={setSelectedItem}
                questItemIndex={questItemIndex}
                questAvailabilityQuests={questAvailabilityQuestList}
            />

            <DataLastUpdated />

            <ItemSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelect={(item) => {
                    setSelectedItem(item);
                    setIsSearchOpen(false);
                }}
                itemPool={allSearchableItems}
            />

            {selectedItem && (
                <ItemDetailModal
                    item={selectedItem}
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    stations={stations ?? []}
                    stationLevels={stationLevels}
                    hiddenStations={hiddenStations}
                    completedRequirements={completedRequirements}
                    questItemIndex={questItemIndex}
                    questAvailabilityQuests={questAvailabilityQuestList}
                />
            )}
        </main>
    );
}
