"use client";

import { useEffect } from "react";
import type { Station, ItemDetails } from "@/types";
import { useDataStore } from "@/lib/stores/useDataStore";
import { useUserStore } from "@/lib/stores/useUserStore";

interface AppBootstrapProps {
    stations: Station[] | null;
    stationsUpdatedAt: number | null;
    items?: ItemDetails[] | null;
    itemsUpdatedAt?: number | null;
}

export function AppBootstrap({ stations, stationsUpdatedAt, items, itemsUpdatedAt }: AppBootstrapProps) {
    const { setStations, setItems } = useDataStore();
    const { initializeDefaults } = useUserStore();

    useEffect(() => {
        if (stations && stations.length > 0) {
            setStations(stations, stationsUpdatedAt ?? undefined);
            initializeDefaults(stations);
        }
    }, [stations, stationsUpdatedAt, setStations, initializeDefaults]);

    useEffect(() => {
        if (items && items.length > 0) {
            const itemsMap: Record<string, ItemDetails> = {};
            items.forEach((item) => {
                itemsMap[item.id] = item;
            });
            setItems(itemsMap, itemsUpdatedAt ?? undefined);
        }
    }, [items, itemsUpdatedAt, setItems]);

    return null;
}
