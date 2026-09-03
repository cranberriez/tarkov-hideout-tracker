"use client";

import { useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { computeNeeds } from "@/lib/utils/item-needs";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import { StationCardHeader } from "./StationCardHeader";
import { StationRequirementsSection } from "./StationRequirementsSection";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";

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

    const [selectedItem, setSelectedItem] = useState<ItemSummary | null>(null);

    const currentLevel = stationLevels[station.id] ?? 0;
    const maxLevel = station.levels.length;

    const nextLevelData = station.levels.find((l) => l.level === currentLevel + 1);
    const currentLevelData = station.levels.find((l) => l.level === currentLevel);
    const isMaxed = currentLevel >= maxLevel;
    const isHidden = hiddenStations[station.id] || isMaxed;

    const computeUpgradeStatus = (): "ready" | "missing" | "illegal" => {
        let isIllegal = false;

        if (currentLevelData) {
            for (const req of currentLevelData.stationLevelRequirements ?? []) {
                const reqStation = stations.find(
                    (s) => s.normalizedName === req.station.normalizedName
                );
                if (!reqStation) continue;
                const reqStationLevel = stationLevels[reqStation.id] ?? 0;
                if (reqStationLevel < req.level) {
                    isIllegal = true;
                    break;
                }
            }
        }

        if (isIllegal) return "illegal";

        if (!nextLevelData) return "missing";

        let stationReqMissing = false;
        for (const req of nextLevelData.stationLevelRequirements ?? []) {
            const reqStation = stations.find(
                (s) => s.normalizedName === req.station.normalizedName
            );
            if (!reqStation) continue;
            const reqStationLevel = stationLevels[reqStation.id] ?? 0;
            if (reqStationLevel < req.level) {
                stationReqMissing = true;
                break;
            }
        }

        let itemsMissing = false;
        if (nextLevelData && !itemsMissing) {
            for (const req of nextLevelData.itemRequirements) {
                const item = itemById[req.itemId];
                if (!item) continue;
                const norm = item.normalizedName;
                const isCurrency = norm === "roubles" || norm === "dollars" || norm === "euros";

                if (isCurrency) {
                    continue;
                }

                const owned = itemCounts[req.itemId] ?? { have: 0, haveFir: 0 };

                if (req.isFir) {
                    if (owned.haveFir < req.count) {
                        itemsMissing = true;
                        break;
                    }
                } else {
                    const globalFirRemaining = pooledFirByItem[req.itemId] ?? 0;
                    const firSurplus = Math.max(0, owned.haveFir - globalFirRemaining);
                    const needs = computeNeeds({
                        totalRequired: req.count,
                        requiredFir: 0,
                        haveNonFir: owned.have + firSurplus,
                        haveFir: 0,
                    });

                    if (needs.effectiveHave < req.count) {
                        itemsMissing = true;
                        break;
                    }
                }
            }
        }

        if (!stationReqMissing && !itemsMissing) {
            return "ready";
        }

        return "missing";
    };

    const upgradeStatus = computeUpgradeStatus();

    const handleLevelUp = () => {
        if (isMaxed) return;
        const targetLevel = currentLevel + 1;
        const levelData = station.levels.find((l) => l.level === targetLevel);
        if (!levelData) return;

        for (const req of levelData.itemRequirements) {
            const item = itemById[req.itemId];
            if (!item) continue;
            const norm = item.normalizedName;
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
                if (!item) continue;
                const norm = item.normalizedName;
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
                    onClickItem={setSelectedItem}
                    pooledFirByItem={pooledFirByItem}
                    itemById={itemById}
                    upgradeStatus={upgradeStatus}
                />
            )}

            {selectedItem && (
                <ItemDetailModal
                    item={selectedItem}
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
}
