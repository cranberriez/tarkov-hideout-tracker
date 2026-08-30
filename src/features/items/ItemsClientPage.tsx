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
import type { QuestAnyOfGroupEntry, QuestItemIndexEntry, QuestRewardIndexEntry } from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { DataLoadError } from "@/components/core/DataLoadError";

interface ItemsClientPageProps {
    questItemIndex: QuestItemIndexEntry[];
    questRewardIndex: QuestRewardIndexEntry[];
    questAnyOfGroups: QuestAnyOfGroupEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
}

export function ItemsClientPage({
    questItemIndex,
    questRewardIndex,
    questAnyOfGroups,
    questAvailabilityQuests,
}: ItemsClientPageProps) {
    const {
        stations,
        stationsUpdatedAt,
        stationsError,
        items,
        itemsUpdatedAt,
        itemsError,
    } = useDataContext();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ItemDetails | null>(null);

    const {
        stationLevels,
        hiddenStations,
        completedRequirements,
        gameMode,
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

    const questAvailabilityQuestList = useMemo(
        () => questAvailabilityQuests,
        [questAvailabilityQuests],
    );

    // Quest-specific pickup items are intentionally absent from the standard catalog.
    const allSearchableItems = useMemo(() => items ?? [], [items]);

    return (
        <main className="container mx-auto px-6 py-8">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        ITEM CHECKLIST
                    </h1>
                </div>
                <div className="flex items-center gap-3 self-start rounded-sm border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400 sm:self-auto">
                    <span>Active profile prices</span>
                    <span
                        className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono font-semibold tracking-wide transition-all shadow-md ${
                            gameMode === "PVP"
                                ? "border-red-500/70 bg-red-900/60 text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.45)]"
                                : gameMode === "PVE"
                                  ? "border-sky-400/80 bg-sky-900/70 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.7)]"
                                  : "border-amber-400/80 bg-amber-900/70 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.45)]"
                        }`}
                    >
                        <span>{gameMode}</span>
                    </span>
                </div>
            </div>

            <div className="mb-8">
                {stationsError || itemsError || !stations || !items ? (
                    <DataLoadError
                        title="Hideout item data is unavailable"
                        messages={[
                            ...(stationsError ? [stationsError] : []),
                            ...(itemsError ? [itemsError] : []),
                            ...(!stations && !stationsError
                                ? ["Hideout station data could not be loaded."]
                                : []),
                            ...(!items && !itemsError
                                ? ["Hideout item data could not be loaded."]
                                : []),
                        ]}
                    />
                ) : (
                    <ItemsControls onOpenSearch={() => setIsSearchOpen(true)}>
                        <ItemsStatsRow
                            questItemIndex={questItemIndex}
                            questAnyOfGroups={questAnyOfGroups}
                            questAvailabilityQuests={questAvailabilityQuestList}
                        />
                        <ItemsList
                            onClickItem={setSelectedItem}
                            questItemIndex={questItemIndex}
                            questAnyOfGroups={questAnyOfGroups}
                            questAvailabilityQuests={questAvailabilityQuestList}
                        />
                    </ItemsControls>
                )}
            </div>

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
                    questRewardIndex={questRewardIndex}
                    questAnyOfGroups={questAnyOfGroups}
                    questAvailabilityQuests={questAvailabilityQuestList}
                />
            )}
        </main>
    );
}
