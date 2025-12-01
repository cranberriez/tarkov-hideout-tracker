import type { Station, ItemDetails } from "@/types";
import { NonItemRequirements } from "./NonItemRequirements";
import { CompactItemRequirements } from "./ItemRequirementsCompact";
import { ExpandedItemRequirements } from "./ItemRequirementsExpanded";
import { Clock } from "lucide-react";

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
    const formatTimeLength = (time: number) => {
        const hours = Math.floor(time / 60 / 60);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = time % 60;
        if (hours > 0 && minutes <= 0) return `${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    };

    return (
        <div className="p-3 flex-1 flex flex-col gap-2 bg-card/50 relative">
            {!isMaxed && nextLevelData ? (
                <>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">
                            Next Level Requires:
                        </div>
                        <div className="ml-auto flex items-center text-right text-[10px] font-bold uppercase tracking-wider">
                            {upgradeStatus === "ready" && (
                                <span className="text-tarkov-green">Ready to Upgrade</span>
                            )}
                            {/* {upgradeStatus === "missing" && (
                                <span className="text-muted-foreground/50">Requirements Missing</span>
                            )} */}
                            {upgradeStatus === "illegal" && (
                                <span className="text-red-400">Illegal State</span>
                            )}
                            {nextLevelData.constructionTime > 0 && (
                                <span className="px-1 py-px rounded text-gray-300 text-[12px] flex items-center gap-1">
                                    <Clock size={10} />
                                    {formatTimeLength(nextLevelData.constructionTime)}
                                </span>
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
