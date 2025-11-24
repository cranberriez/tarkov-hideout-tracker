"use client";

import { useState } from "react";
import { ItemsList } from "../features/items/components/ItemsList";
import { ItemsControls } from "../features/items/components/ItemsControls";
import { ItemSearchModal } from "../features/items/components/ItemSearchModal";
import { ItemDetailModal } from "../features/items/components/ItemDetailModal";
import { ItemDetails } from "../types";
import { useDataStore } from "../lib/stores/useDataStore";
import { useUserStore } from "../lib/stores/useUserStore";

export default function ItemsPage() {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ItemDetails | null>(null);

    const { stations } = useDataStore();
    const { stationLevels, hiddenStations } = useUserStore();

    return (
        <main className="container mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">ITEM CHECKLIST</h1>
                <p className="text-gray-400 mt-2 text-sm">
                    Aggregated list of items required for your hideout upgrades
                </p>
            </div>

            <div className="mb-8">
                <ItemsControls onOpenSearch={() => setIsSearchOpen(true)} />
            </div>

            <ItemsList onClickItem={setSelectedItem} />

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
                stations={stations}
                stationLevels={stationLevels}
                hiddenStations={hiddenStations}
            />
        </main>
    );
}
