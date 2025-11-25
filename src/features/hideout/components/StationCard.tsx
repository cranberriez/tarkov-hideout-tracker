"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useDataStore } from "@/lib/stores/useDataStore";
import type { Station } from "@/types";
import { StationCardHeader } from "./StationCardHeader";
import { StationRequirementsSection } from "./StationRequirementsSection";

interface StationCardProps {
    station: Station;
    isLocked?: boolean;
}

export function StationCard({ station, isLocked = false }: StationCardProps) {
    const {
        stationLevels,
        setStationLevel,
        hiddenStations,
        toggleHiddenStation,
        hideoutCompactMode,
        showHidden,
        completedRequirements,
        toggleRequirement,
        hideMoney,
        hideRequirements,
    } = useUserStore();

    const { stations } = useDataStore();

    const currentLevel = stationLevels[station.id] ?? 0;
    const isHidden = hiddenStations[station.id];
    const maxLevel = station.levels.length;

    const nextLevelData = station.levels.find((l) => l.level === currentLevel + 1);
    const isMaxed = currentLevel >= maxLevel;

    // If hidden and showHidden is false, don't render (handled by parent usually, but good safety)
    if (isHidden && !showHidden) return null;

    return (
        <div
            className={`bg-card border border-border-color rounded overflow-hidden flex flex-col transition-opacity ${
                isHidden ? "opacity-50 grayscale" : ""
            }`}
        >
            <StationCardHeader
                station={station}
                isLocked={isLocked}
                isHidden={isHidden}
                currentLevel={currentLevel}
                maxLevel={maxLevel}
                isMaxed={isMaxed}
                setStationLevel={setStationLevel}
                toggleHiddenStation={toggleHiddenStation}
                hideRequirements={hideRequirements}
            />

            {/* Content */}
            {!hideRequirements && (
                <StationRequirementsSection
                    station={station}
                    isMaxed={isMaxed}
                    nextLevelData={nextLevelData}
                    stations={stations}
                    stationLevels={stationLevels}
                    completedRequirements={completedRequirements}
                    toggleRequirement={toggleRequirement}
                    hideMoney={hideMoney}
                    hideoutCompactMode={hideoutCompactMode}
                />
            )}
        </div>
    );
}
