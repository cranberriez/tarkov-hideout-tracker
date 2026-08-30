"use client";

import { useState } from "react";
import type { MarketPrice } from "@/types";
import { ItemDetailInventory } from "./ItemDetailInventory";
import { ItemDetailMarket } from "./ItemDetailMarket";

interface ItemDetailSidebarProps {
    itemId: string;
    owned: { have: number; haveFir: number };
    marketPrice: MarketPrice | null | undefined;
    relativeUpdatedAt: string | null;
    isFiat: boolean;
    showMarket: boolean;
    minLevelForFlea?: number | null;
    playerLevel: number;
    onAddItemCounts: (itemId: string, haveDelta: number, haveFirDelta: number) => void;
}

export function ItemDetailSidebar({
    itemId,
    owned,
    marketPrice,
    relativeUpdatedAt,
    isFiat,
    showMarket,
    minLevelForFlea,
    playerLevel,
    onAddItemCounts,
}: ItemDetailSidebarProps) {
    const [draftNonFir, setDraftNonFir] = useState(owned.have);
    const [draftFir, setDraftFir] = useState(owned.haveFir);
    const hasChanges = draftNonFir !== owned.have || draftFir !== owned.haveFir;

    const resetInventory = () => {
        setDraftNonFir(owned.have);
        setDraftFir(owned.haveFir);
    };

    const saveInventory = () => {
        if (!hasChanges) return;
        onAddItemCounts(itemId, draftNonFir - owned.have, draftFir - owned.haveFir);
    };

    return (
        <aside className="overflow-hidden border-b border-border-color bg-card/45 lg:border-r lg:border-b-0">
            <ItemDetailInventory
                draftNonFir={draftNonFir}
                draftFir={draftFir}
                setDraftNonFir={setDraftNonFir}
                setDraftFir={setDraftFir}
                hasChanges={hasChanges}
                onReset={resetInventory}
                onSave={saveInventory}
            />
            {showMarket && marketPrice && (
                <ItemDetailMarket
                    marketPrice={marketPrice}
                    relativeUpdatedAt={relativeUpdatedAt}
                    valuationCount={draftNonFir + draftFir}
                    isFiat={isFiat}
                    minLevelForFlea={minLevelForFlea}
                    playerLevel={playerLevel}
                />
            )}
        </aside>
    );
}
