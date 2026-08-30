import type { ReactNode } from "react";
import {
    getCachedHideoutRequiredItems,
    getCachedHideoutStations,
} from "@/server/services/tarkovData";
import { DataProvider, type DataContextValue } from "@/app/(data)/_dataContext";
import PriceDataLayout from "@/app/(data)/PriceDataLayout";
import { QuickAddModal } from "@/features/quick-add/QuickAddModal";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { LegacyProfileConversionDialog } from "@/features/profile-conversion/LegacyProfileConversionDialog";
import { RouteAwareFooter } from "@/components/core/RouteAwareFooter";
import { tarkovDataSource } from "@/server/services/tarkovData";
import { isCacheEnabled } from "@/server/cache";
import { PROGRESSION_DATA_FROZEN } from "@/lib/cfg/cacheVersions";

interface DataLayoutProps {
    children: ReactNode;
}

export default async function DataLayout({ children }: DataLayoutProps) {
    const gameMode = await getActiveTarkovJsonGameMode();
    const [stationsResult, itemsResult] = await Promise.allSettled([
        getCachedHideoutStations(gameMode),
        getCachedHideoutRequiredItems(gameMode),
    ]);

    const modeLabel = gameMode === "pvp-season" ? "KORD" : gameMode.toUpperCase();
    const stationsResponse =
        stationsResult.status === "fulfilled" ? stationsResult.value : null;
    const itemsResponse = itemsResult.status === "fulfilled" ? itemsResult.value : null;

    const value: DataContextValue = {
        stations: stationsResponse?.data.stations ?? null,
        stationsUpdatedAt: stationsResponse?.updatedAt ?? null,
        stationsError:
            stationsResult.status === "rejected"
                ? `Hideout station data for ${modeLabel} could not be loaded.`
                : null,
        stationsDiagnostics: stationsResponse?.diagnostics ?? null,
        items: itemsResponse?.data.items ?? null,
        itemsUpdatedAt: itemsResponse?.updatedAt ?? null,
        itemsError:
            itemsResult.status === "rejected"
                ? `Hideout item data for ${modeLabel} could not be loaded.`
                : null,
        itemsDiagnostics: itemsResponse?.diagnostics ?? null,
    };

    const provider = tarkovDataSource === "json" || gameMode !== "regular" ? "json" : "graphql";

    return (
        <DataProvider value={value}>
            <PriceDataLayout>
                {children}
                <RouteAwareFooter
                    statusConfig={{
                        provider,
                        configuredProvider: tarkovDataSource,
                        activeDataset: gameMode,
                        cacheEnabled: isCacheEnabled,
                        progressionDataFrozen: PROGRESSION_DATA_FROZEN,
                    }}
                />
                <QuickAddModal />
                <LegacyProfileConversionDialog />
            </PriceDataLayout>
        </DataProvider>
    );
}
