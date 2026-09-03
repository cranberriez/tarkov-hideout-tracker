import type { ReactNode } from "react";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { LegacyProfileConversionDialog } from "@/features/profile-conversion/LegacyProfileConversionDialog";
import { RouteAwareFooter } from "@/components/core/RouteAwareFooter";
import { getActiveDataReleaseId } from "@/server/db/release-config";

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
                    activeDataset: gameMode,
                    releaseId: getActiveDataReleaseId(gameMode),
                }}
            />
            <LegacyProfileConversionDialog />
        </>
    );
}
