import type { ReactNode } from "react";
import { getCachedHideoutStations } from "@/server/services/tarkovData";
import { getGlobalItemList } from "@/server/services/itemsJson";
import { DataProvider, type DataContextValue } from "@/app/(data)/_dataContext";
import { QuickAddModal } from "@/features/quick-add/QuickAddModal";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { LegacyProfileConversionDialog } from "@/features/profile-conversion/LegacyProfileConversionDialog";
import { RouteAwareFooter } from "@/components/core/RouteAwareFooter";
import { tarkovDataSource } from "@/server/services/tarkovData";
import { isCacheEnabled } from "@/server/cache";
import { PROGRESSION_DATA_FROZEN } from "@/lib/cfg/cacheVersions";
import { getRedisCacheStatus } from "@/server/redis";
import { ActiveGameModeSync } from "@/components/core/ActiveGameModeSync";

interface DataLayoutProps {
    children: ReactNode;
}

export default async function DataLayout({ children }: DataLayoutProps) {
    const gameMode = await getActiveTarkovJsonGameMode();
    const [stationsResult, itemsResult] = await Promise.allSettled([
        getCachedHideoutStations(gameMode),
        getGlobalItemList(gameMode),
    ]);

    const modeLabel = gameMode === "pvp-season" ? "KORD" : gameMode.toUpperCase();
    const stationsResponse =
        stationsResult.status === "fulfilled" ? stationsResult.value : null;
    const itemsResponse = itemsResult.status === "fulfilled" ? itemsResult.value : null;
    const items = itemsResponse?.data.items ?? null;
    const stations = stationsResponse?.data.stations ?? null;

    const value: Omit<DataContextValue, "itemById"> = {
        stations,
        stationsUpdatedAt: stationsResponse?.updatedAt ?? null,
        stationsError:
            stationsResult.status === "rejected"
                ? `Hideout station data for ${modeLabel} could not be loaded.`
                : null,
        stationsDiagnostics: stationsResponse?.diagnostics ?? null,
        items,
        itemsUpdatedAt: itemsResponse?.updatedAt ?? null,
        itemsError:
            itemsResult.status === "rejected"
                ? `Item catalog data for ${modeLabel} could not be loaded.`
                : null,
        itemsDiagnostics: itemsResponse?.diagnostics ?? null,
    };

    const provider = tarkovDataSource === "json" || gameMode !== "regular" ? "json" : "graphql";

    return (
        <DataProvider value={value}>
            <ActiveGameModeSync />
            {children}
            <RouteAwareFooter
                statusConfig={{
                    provider,
                    configuredProvider: tarkovDataSource,
                    activeDataset: gameMode,
                    cacheEnabled: isCacheEnabled,
                    redisState: getRedisCacheStatus().state,
                    progressionDataFrozen: PROGRESSION_DATA_FROZEN,
                }}
            />
            <QuickAddModal />
            <LegacyProfileConversionDialog />
        </DataProvider>
    );
}
