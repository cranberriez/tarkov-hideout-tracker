"use client";

import { useDeferredPriceItems } from "@/features/items/DeferredPriceBoundary";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ItemSummary } from "@/types/items";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemsList } from "@/features/items/components/ItemsList";
import { ItemsControls } from "@/features/items/components/ItemsControls";
import { ItemsStatsRow } from "@/features/items/components/ItemsStatsRow";
import { ItemDetailModal } from "@/features/items/item-detail/LazyItemDetailModal";
import { DataLastUpdated } from "@/components/computed/DataLastUpdated";
import { DataLoadError } from "@/components/core/DataLoadError";
import type { ItemChecklistPageData } from "@/types/contracts";
import { PROFILE_BASE_COLORS } from "@/lib/cfg/profile-colors";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStoreHydrated } from "@/lib/query/game-data";

interface ItemsClientPageProps {
    data: ItemChecklistPageData;
    dataMode: TarkovJsonGameMode;
}

export function ItemsClientPage({ data, dataMode }: ItemsClientPageProps) {
    const {
        stations,
        items: initialItems,
        questItemIndex,
        questAnyOfGroups,
        questAvailabilityQuests,
        freshness,
        errors,
    } = data;
    const items = useDeferredPriceItems(initialItems);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedItem, setSelectedItem] = useState<ItemSummary | null>(null);

    const { gameMode, initializeDefaults } = useUserStore();
    const hydrated = useUserStoreHydrated();

    useEffect(() => {
        if (hydrated && toTarkovJsonGameMode(gameMode) === dataMode && stations && stations.length > 0) {
            initializeDefaults(stations);
        }
    }, [dataMode, gameMode, hydrated, stations, freshness.stationsUpdatedAt, initializeDefaults]);

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
                    <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
                        ITEM CHECKLIST
                    </h1>
                </div>
                <div className="flex items-center gap-3 self-start rounded-sm border border-highlight/10 bg-shadow/20 px-3 py-2 text-xs text-muted-foreground sm:self-auto">
                    <span>Active profile prices</span>
                    <span
                        style={{ "--profile-color": PROFILE_BASE_COLORS[gameMode] } as CSSProperties}
                        className="inline-flex items-center gap-2 rounded-sm border border-[color-mix(in_srgb,var(--profile-color)_80%,transparent)] bg-[color-mix(in_srgb,var(--profile-color)_18%,var(--background))] px-3 py-1.5 font-mono font-semibold tracking-wide text-[color-mix(in_srgb,var(--profile-color)_55%,var(--foreground))] shadow-md shadow-[color-mix(in_srgb,var(--profile-color)_45%,transparent)] transition-all"
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
                        <ItemsControls
                            searchQuery={searchQuery}
                            onSearchQueryChange={setSearchQuery}
                        >
                            <ItemsStatsRow
                                stations={stations}
                                items={items}
                                questItemIndex={questItemIndex}
                                questAnyOfGroups={questAnyOfGroups}
                                questAvailabilityQuests={questAvailabilityQuestList}
                            />
                            <ItemsList
                                searchQuery={searchQuery}
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

            {selectedItem && (
                <ItemDetailModal
                    item={itemById[selectedItem.id] ?? selectedItem}
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </main>
    );
}
