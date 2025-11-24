"use client";

import { useEffect } from "react";
import { useDataStore } from "@/app/lib/stores/useDataStore";
import { useUserStore } from "@/app/lib/stores/useUserStore";
import { StationCard } from "./StationCard";

export function HideoutList() {
    const { stations, fetchStations, loadingStations, errorStations } = useDataStore();
    const { initializeDefaults } = useUserStore();

    useEffect(() => {
        fetchStations();
    }, [fetchStations]);

    useEffect(() => {
        if (stations) {
            initializeDefaults(stations);
        }
    }, [stations, initializeDefaults]);

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

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stations.map((station) => (
                <StationCard key={station.id} station={station} />
            ))}
        </div>
    );
}
