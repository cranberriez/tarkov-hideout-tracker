import type { Station, ItemDetails } from "@/types";
import { NonItemRequirements } from "./NonItemRequirements";
import { CompactItemRequirements } from "./ItemRequirementsCompact";
import { ExpandedItemRequirements } from "./ItemRequirementsExpanded";

export interface StationRequirementsSectionProps {
    station: Station;
    isMaxed: boolean;
    nextLevelData?: Station["levels"][number];
    stations: Station[] | null;
    stationLevels: Record<string, number>;
    completedRequirements: Record<string, boolean>;
    toggleRequirement: (requirementId: string) => void;
    hideMoney: boolean;
    hideoutCompactMode: boolean;
    onClickItem: (item: ItemDetails) => void;
    pooledFirByItem: Record<string, number>;
    upgradeStatus: "ready" | "missing" | "illegal";
}

export function StationRequirementsSection({
    station,
    isMaxed,
    nextLevelData,
    stations,
    stationLevels,
    completedRequirements,
    toggleRequirement,
    hideMoney,
    hideoutCompactMode,
    onClickItem,
    pooledFirByItem,
    upgradeStatus,
}: StationRequirementsSectionProps) {
    return (
        <div className="p-3 flex-1 flex flex-col gap-2 bg-card/50 relative">
            {!isMaxed && nextLevelData ? (
                <>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">
                            Next Level Requires:
                        </div>
                        <div className="flex-1 text-right text-[10px] font-bold uppercase tracking-wider">
                            {upgradeStatus === "ready" && (
                                <span className="text-tarkov-green">Ready to Upgrade</span>
                            )}
                            {/* {upgradeStatus === "missing" && (
                                <span className="text-muted-foreground/50">Requirements Missing</span>
                            )} */}
                            {upgradeStatus === "illegal" && (
                                <span className="text-red-400">Illegal State</span>
                            )}
                        </div>
                    </div>

                    {/* Non-Item Requirements (Stations, Skills, Traders) */}
                    <NonItemRequirements
                        station={station}
                        nextLevelData={nextLevelData}
                        stations={stations}
                        stationLevels={stationLevels}
                    />

                    {hideoutCompactMode ? (
                        // Compact Grid View
                        <CompactItemRequirements
                            nextLevelData={nextLevelData}
                            hideMoney={hideMoney}
                            completedRequirements={completedRequirements}
                            toggleRequirement={toggleRequirement}
                            onClickItem={onClickItem}
                            pooledFirByItem={pooledFirByItem}
                        />
                    ) : (
                        // Expanded List View
                        <ExpandedItemRequirements
                            nextLevelData={nextLevelData}
                            hideMoney={hideMoney}
                            completedRequirements={completedRequirements}
                            toggleRequirement={toggleRequirement}
                            onClickItem={onClickItem}
                            pooledFirByItem={pooledFirByItem}
                        />
                    )}
                </>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-600 text-xs italic py-4">
                    Max level reached
                </div>
            )}
        </div>
    );
}
