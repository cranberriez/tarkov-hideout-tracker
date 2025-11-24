"use client";

import { useEffect, useMemo } from "react";
import { useDataStore } from "@/app/lib/stores/useDataStore";
import { useUserStore } from "@/app/lib/stores/useUserStore";
import { StationCard } from "./StationCard";
import { stationOrder } from "@/app/lib/cfg/stationOrder";
import type { Station } from "@/app/types";

export function HideoutList() {
    const { stations, fetchStations, loadingStations, errorStations } = useDataStore();
    const { initializeDefaults, stationLevels } = useUserStore();

    useEffect(() => {
        fetchStations();
    }, [fetchStations]);

    useEffect(() => {
        if (stations) {
            initializeDefaults(stations);
        }
    }, [stations, initializeDefaults]);

    const sortedStations = useMemo(() => {
        if (!stations) return { upgradeable: [], locked: [], maxed: [] };

        // 1. Map normalized names to order index
        const orderMap = new Map(stationOrder.map((name, index) => [name, index]));
        const getOrder = (name: string) => orderMap.get(name) ?? 999;

        // 2. Helper to check if station is locked
        const isStationLocked = (station: Station) => {
            const currentLevel = stationLevels[station.id] ?? 0;
            const nextLevelData = station.levels.find((l) => l.level === currentLevel + 1);
            if (!nextLevelData) return false; // Maxed or invalid

            // Check station level requirements
            // If ANY requirement is not met, it is locked
            return nextLevelData.stationLevelRequirements.some((req) => {
                // Find the requirement station in our full list to get its ID (or store normalized -> level map)
                // Since we have stationLevels as ID -> Level, we need ID of the req station.
                // We don't strictly have ID of req station here, only normalized name.
                // We have to look it up in the stations list.
                const reqStation = stations.find(
                    (s) => s.normalizedName === req.station.normalizedName
                );
                if (!reqStation) return false; // Should not happen
                const reqStationLevel = stationLevels[reqStation.id] ?? 0;
                return reqStationLevel < req.level;
            });
        };

        // 3. Categorize
        const upgradeable: Station[] = [];
        const locked: Station[] = [];
        const maxed: Station[] = [];

        stations.forEach((station) => {
            const currentLevel = stationLevels[station.id] ?? 0;
            const maxLevel = station.levels.length;

            if (currentLevel >= maxLevel) {
                maxed.push(station);
            } else if (isStationLocked(station)) {
                locked.push(station);
            } else {
                upgradeable.push(station);
            }
        });

        // 4. Sort each category by predefined order
        const sorter = (a: Station, b: Station) =>
            getOrder(a.normalizedName) - getOrder(b.normalizedName);

        upgradeable.sort(sorter);
        locked.sort(sorter);
        maxed.sort(sorter);

        return { upgradeable, locked, maxed };
    }, [stations, stationLevels]);

    if (loadingStations) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tarkov-green"></div>
            </div>
        );
    }

    if (errorStations) {
        return <div className="text-center text-red-500 py-10">Error: {errorStations}</div>;
    }

    if (!stations) {
        return null;
    }

    const { upgradeable, locked, maxed } = sortedStations;

    return (
        <div className="flex flex-col gap-10">
            {/* Upgradeable Section */}
            {upgradeable.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upgradeable.map((station) => (
                        <StationCard key={station.id} station={station} isLocked={false} />
                    ))}
                </div>
            )}

            {/* Locked Section */}
            {locked.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-4 text-gray-500">
                        <div className="h-[1px] flex-1 bg-border-color"></div>
                        <span className="text-xs font-bold uppercase tracking-widest">Locked</span>
                        <div className="h-[1px] flex-1 bg-border-color"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {locked.map((station) => (
                            <StationCard key={station.id} station={station} isLocked={true} />
                        ))}
                    </div>
                </div>
            )}

            {/* Maxed Section */}
            {maxed.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-4 text-gray-500">
                        <div className="h-[1px] flex-1 bg-border-color"></div>
                        <span className="text-xs font-bold uppercase tracking-widest">
                            Completed
                        </span>
                        <div className="h-[1px] flex-1 bg-border-color"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        {maxed.map((station) => (
                            <StationCard key={station.id} station={station} isLocked={false} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
