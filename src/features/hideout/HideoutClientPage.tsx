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
    const { initializeDefaults } = useUserStore();

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

            <HideoutList />
        </main>
    );
}
