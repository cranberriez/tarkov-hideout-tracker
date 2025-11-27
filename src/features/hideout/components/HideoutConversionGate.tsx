"use client";

import { useMemo } from "react";
import { useDataStore } from "@/lib/stores/useDataStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { CompletedItemsConversionModal } from "@/features/items/components/CompletedItemsConversionModal";

export function HideoutConversionGate() {
    const { stations } = useDataStore();
    const {
        stationLevels,
        completedRequirements,
        hasSeenItemConversionModal,
        setHasSeenItemConversionModal,
    } = useUserStore();

    const hasConvertible = useMemo(() => {
        if (!stations) return false;

        return stations.some((station) => {
            const currentLevel = stationLevels[station.id] ?? 0;

            return station.levels.some((level) => {
                if (currentLevel >= level.level) return false;

                return level.itemRequirements.some((req) => completedRequirements[req.id]);
            });
        });
    }, [stations, stationLevels, completedRequirements]);

    const isOpen = hasConvertible && !hasSeenItemConversionModal;

    if (!isOpen) return null;

    return (
        <CompletedItemsConversionModal
            isOpen={true}
            onClose={() => setHasSeenItemConversionModal(true)}
        />
    );
}
