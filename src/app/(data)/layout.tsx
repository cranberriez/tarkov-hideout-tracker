import type { ReactNode } from "react";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { LegacyProfileConversionDialog } from "@/features/profile-conversion/LegacyProfileConversionDialog";
import { RouteAwareFooter } from "@/components/core/RouteAwareFooter";
import { isCacheEnabled } from "@/server/cache";
import { PROGRESSION_DATA_FROZEN } from "@/lib/cfg/cacheVersions";

interface DataLayoutProps {
    children: ReactNode;
}

export default async function DataLayout({ children }: DataLayoutProps) {
    const gameMode = await getActiveTarkovJsonGameMode();

    return (
        <>
            {children}
            <RouteAwareFooter
                statusConfig={{
                    provider: "json",
                    configuredProvider: "json",
                    activeDataset: gameMode,
                    cacheEnabled: isCacheEnabled,
                    progressionDataFrozen: PROGRESSION_DATA_FROZEN,
                }}
            />
            <LegacyProfileConversionDialog />
        </>
    );
}
