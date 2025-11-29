"use client";

import { useEffect } from "react";
import type { Station } from "@/types";
import { useDataStore } from "@/lib/stores/useDataStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { HideoutControls } from "@/features/hideout/components/HideoutControls";
import { HideoutConversionGate } from "@/features/hideout/components/HideoutConversionGate";
import { HideoutList } from "@/features/hideout/components/HideoutList";

interface HideoutClientPageProps {
    stations: Station[] | null;
    stationsUpdatedAt: number | null;
}

export function HideoutClientPage({ stations, stationsUpdatedAt }: HideoutClientPageProps) {
    const { setStations } = useDataStore();
    const { initializeDefaults, hasSeenHideoutLevelWarning, setHasSeenHideoutLevelWarning } =
        useUserStore();

    useEffect(() => {
        if (stations && stations.length > 0) {
            setStations(stations, stationsUpdatedAt ?? undefined);
            initializeDefaults(stations);
        }
    }, [stations, stationsUpdatedAt, setStations, initializeDefaults]);

    return (
        <main className="container mx-auto px-6 py-8">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border-color pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">HIDEOUT STATIONS</h1>
                    <p className="text-gray-400 mt-2 text-sm">
                        Manage your current station levels to calculate required items
                    </p>
                </div>
                <div className="flex flex-col w-full md:w-auto">
                    <HideoutControls />
                    <HideoutConversionGate />
                </div>
            </div>

            {!hasSeenHideoutLevelWarning && (
                <div className="mb-4 flex items-center gap-3 rounded border border-yellow-500/40 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-100 w-full">
                    <div className="flex-1">
                        Increasing or decreasing station levels will affect your item counts. Use
                        the Setup in the extra menu at the top to modify base station levels
                        without adjusting item requirements.
                    </div>
                    <button
                        type="button"
                        onClick={() => setHasSeenHideoutLevelWarning(true)}
                        className="ml-2 text-[10px] uppercase tracking-wide font-mono text-yellow-200 hover:text-yellow-50 hover:bg-yellow-500/20 rounded px-2 py-1"
                    >
                        Close
                    </button>
                </div>
            )}

            <HideoutList />
        </main>
    );
}
