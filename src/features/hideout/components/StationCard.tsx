"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { computeStationUpgradeStatus } from "../station-model";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import { StationCardHeader } from "./StationCardHeader";
import { StationRequirementsSection } from "./StationRequirementsSection";

interface StationCardProps {
    station: Station;
    stations: Station[];
    itemById: Readonly<Record<string, ItemSummary>>;
    isLocked?: boolean;
    pooledFirByItem: Record<string, number>;
}

export function StationCard({
    station,
    stations,
    itemById,
    isLocked = false,
    pooledFirByItem,
}: StationCardProps) {
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
        itemCounts,
        addItemCounts,
    } = useUserStore();

    const currentLevel = stationLevels[station.id] ?? 0;
    const maxLevel = station.levels.length;

    const nextLevelData = station.levels.find((l) => l.level === currentLevel + 1);
    const isMaxed = currentLevel >= maxLevel;
    const isHidden = hiddenStations[station.id] || isMaxed;
    const hasUnresolvedNextLevelItem =
        nextLevelData?.itemRequirements.some((requirement) => !itemById[requirement.itemId]) ??
        false;

    const upgradeStatus = computeStationUpgradeStatus({
        station,
        stations,
        stationLevels,
        itemById,
        itemCounts,
        pooledFirByItem,
    });

    const handleLevelUp = () => {
        if (isMaxed || hasUnresolvedNextLevelItem) return;
        const targetLevel = currentLevel + 1;
        const levelData = station.levels.find((l) => l.level === targetLevel);
        if (!levelData) return;

        for (const req of levelData.itemRequirements) {
            const item = itemById[req.itemId];
            const norm = item?.normalizedName ?? "";
            const isCurrency = norm === "roubles" || norm === "dollars" || norm === "euros";

            let haveDelta = 0;
            let haveFirDelta = 0;

            if (isCurrency) {
                haveDelta -= req.count;
            } else if (req.isFir) {
                haveFirDelta -= req.count;
            } else {
                haveDelta -= req.count;
            }

            if (haveDelta !== 0 || haveFirDelta !== 0) {
                addItemCounts(req.itemId, haveDelta, haveFirDelta);
            }
        }

        setStationLevel(station.id, targetLevel);
    };

    const handleLevelDown = () => {
        if (currentLevel === 0) return;

        const levelData = station.levels.find((l) => l.level === currentLevel);

        if (levelData) {
            for (const req of levelData.itemRequirements) {
                const item = itemById[req.itemId];
                const norm = item?.normalizedName ?? "";
                const isCurrency = norm === "roubles" || norm === "dollars" || norm === "euros";

                let haveDelta = 0;
                let haveFirDelta = 0;

                if (isCurrency) {
                    haveDelta += req.count;
                } else if (req.isFir) {
                    haveFirDelta += req.count;
                } else {
                    haveDelta += req.count;
                }

                if (haveDelta !== 0 || haveFirDelta !== 0) {
                    addItemCounts(req.itemId, haveDelta, haveFirDelta);
                }
            }
        }

        setStationLevel(station.id, Math.max(0, currentLevel - 1));
    };

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
                hideRequirements={hideRequirements}
                toggleHiddenStation={toggleHiddenStation}
                onLevelDown={handleLevelDown}
                onLevelUp={handleLevelUp}
                upgradeStatus={upgradeStatus}
                hasUnresolvedItemData={hasUnresolvedNextLevelItem}
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
                    pooledFirByItem={pooledFirByItem}
                    itemById={itemById}
                    upgradeStatus={upgradeStatus}
                />
            )}

        </div>
    );
}
