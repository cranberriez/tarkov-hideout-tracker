"use client";

import { useEffect, useState } from "react";
import type { ItemDetails } from "@/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemsList } from "@/features/items/components/ItemsList";
import { ItemsControls } from "@/features/items/components/ItemsControls";
import { ItemSearchModal } from "@/features/items/components/ItemSearchModal";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";
import { DataLastUpdated } from "@/components/computed/DataLastUpdated";
import { useDataContext } from "@/app/(data)/_dataContext";

export function ItemsClientPage() {
    const { stations, stationsUpdatedAt, items, itemsUpdatedAt } = useDataContext();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ItemDetails | null>(null);

    const { stationLevels, hiddenStations, completedRequirements, toggleRequirement, gameMode, setGameMode, initializeDefaults } =
        useUserStore();

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

    return (
        <main className="container mx-auto px-6 py-8">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        ITEM CHECKLIST
                    </h1>
                    <p className="text-gray-400 mt-2 text-sm">
                        Aggregated list of items required for your hideout upgrades
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
            </div>

            <ItemsList onClickItem={setSelectedItem} />

            <DataLastUpdated />

            <ItemSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelect={(item) => {
                    setSelectedItem(item);
                    setIsSearchOpen(false);
                }}
            />

            <ItemDetailModal
                item={selectedItem}
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                stations={stations ?? []}
                stationLevels={stationLevels}
                hiddenStations={hiddenStations}
                completedRequirements={completedRequirements}
                toggleRequirement={toggleRequirement}
            />
        </main>
    );
}
