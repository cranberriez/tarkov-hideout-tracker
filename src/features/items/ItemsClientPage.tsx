"use client";

import { useEffect, useMemo, useState } from "react";
import type { ItemSummary } from "@/types/items";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemsList } from "@/features/items/components/ItemsList";
import { ItemsControls } from "@/features/items/components/ItemsControls";
import { ItemsStatsRow } from "@/features/items/components/ItemsStatsRow";
import { ItemSearchModal } from "@/features/items/components/ItemSearchModal";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";
import { DataLastUpdated } from "@/components/computed/DataLastUpdated";
import { DataLoadError } from "@/components/core/DataLoadError";
import type { ItemChecklistPageData } from "@/types/contracts";

interface ItemsClientPageProps {
    data: ItemChecklistPageData;
}

export function ItemsClientPage({ data }: ItemsClientPageProps) {
    const {
        stations,
        items,
        questItemIndex,
        questAnyOfGroups,
        questAvailabilityQuests,
        freshness,
        errors,
    } = data;
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ItemSummary | null>(null);

    const {
        gameMode,
        initializeDefaults,
    } = useUserStore();

    useEffect(() => {
        if (stations && stations.length > 0) {
            initializeDefaults(stations);
        }
    }, [stations, freshness.stationsUpdatedAt, initializeDefaults]);

    const itemById = useMemo(
        () => Object.fromEntries((items ?? []).map((item) => [item.id, item])),
        [items],
    );

    const questAvailabilityQuestList = useMemo(
        () => questAvailabilityQuests,
        [questAvailabilityQuests],
    );

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
                {errors.stations || errors.items || !stations || !items ? (
                    <DataLoadError
                        title="Hideout item data is unavailable"
                        messages={[
                            ...(errors.stations ? [errors.stations] : []),
                            ...(errors.items ? [errors.items] : []),
                            ...(!stations && !errors.stations
                                ? ["Hideout station data could not be loaded."]
                                : []),
                            ...(!items && !errors.items
                                ? ["Hideout item data could not be loaded."]
                                : []),
                        ]}
                    />
                ) : (
                    <>
                        {errors.quests && (
                            <div className="mb-4">
                                <DataLoadError
                                    title="Quest checklist data is unavailable"
                                    messages={[errors.quests]}
                                />
                            </div>
                        )}
                        <ItemsControls onOpenSearch={() => setIsSearchOpen(true)}>
                            <ItemsStatsRow
                                stations={stations}
                                items={items}
                                questItemIndex={questItemIndex}
                                questAnyOfGroups={questAnyOfGroups}
                                questAvailabilityQuests={questAvailabilityQuestList}
                            />
                            <ItemsList
                                stations={stations}
                                itemById={itemById}
                                onClickItem={setSelectedItem}
                                questItemIndex={questItemIndex}
                                questAnyOfGroups={questAnyOfGroups}
                                questAvailabilityQuests={questAvailabilityQuestList}
                            />
                        </ItemsControls>
                    </>
                )}
            </div>

            <DataLastUpdated
                stationsUpdatedAt={freshness.stationsUpdatedAt}
                itemsUpdatedAt={freshness.itemsUpdatedAt}
            />

            <ItemSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelect={(item) => {
                    setSelectedItem(item);
                    setIsSearchOpen(false);
                }}
            />

            {selectedItem && (
                <ItemDetailModal
                    item={selectedItem}
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </main>
    );
}
