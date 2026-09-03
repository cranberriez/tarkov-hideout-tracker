"use client";

import { useEffect, useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { HideoutControls } from "@/features/hideout/components/HideoutControls";
import { HideoutConversionGate } from "@/features/hideout/components/HideoutConversionGate";
import { HideoutList } from "@/features/hideout/components/HideoutList";
import { DataLoadError } from "@/components/core/DataLoadError";
import type { HideoutPageData } from "@/types/contracts";

interface HideoutClientPageProps {
    data: HideoutPageData;
}

export function HideoutClientPage({ data }: HideoutClientPageProps) {
    const { stations, items, freshness, errors } = data;
    const itemById = useMemo(
        () => Object.fromEntries((items ?? []).map((item) => [item.id, item])),
        [items],
    );
    const { initializeDefaults, hasSeenHideoutLevelWarning, setHasSeenHideoutLevelWarning } =
        useUserStore();

    useEffect(() => {
        if (stations && stations.length > 0) {
            initializeDefaults(stations);
        }
    }, [stations, freshness.stationsUpdatedAt, initializeDefaults]);

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
                    {stations && <HideoutConversionGate stations={stations} />}
                </div>
            </div>

            {!hasSeenHideoutLevelWarning && (
                <div className="mb-4 flex items-center gap-3 rounded border border-yellow-500/40 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-100 w-full">
                    <div className="flex-1">
                        Increasing or decreasing station levels will affect your item counts. Use
                        Setup at the top to modify base station levels without adjusting item
                        requirements.
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

            {errors.stations || errors.items || !stations || !items ? (
                <DataLoadError
                    title="Hideout data is unavailable"
                    messages={[
                        errors.stations,
                        errors.items,
                        !stations ? "Hideout station data could not be loaded." : null,
                        !items ? "Hideout item data could not be loaded." : null,
                    ].filter((message): message is string => Boolean(message))}
                />
            ) : (
                <HideoutList
                    stations={stations}
                    itemById={itemById}
                    stationsUpdatedAt={freshness.stationsUpdatedAt}
                    itemsUpdatedAt={freshness.itemsUpdatedAt}
                />
            )}
        </main>
    );
}
