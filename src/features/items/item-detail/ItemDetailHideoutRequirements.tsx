"use client";

interface StationRequirementEntry {
    stationName: string;
    stationNormalizedName: string;
    stationId: string;
    level: number;
    count: number;
    isFir: boolean;
    isCompleted: boolean;
    isStationMaxed: boolean;
    requirementId: string;
}

interface ItemDetailHideoutRequirementsProps {
    stationRequirements: [string, StationRequirementEntry[]][];
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
}

export function ItemDetailHideoutRequirements({
    stationRequirements,
    stationLevels,
    hiddenStations,
}: ItemDetailHideoutRequirementsProps) {
    return (
        <div className="lg:col-span-2">
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 sm:mb-3">
                Hideout Requirements
            </h3>
            <div className="space-y-3">
                {stationRequirements.length > 0 ? (
                    stationRequirements.map(([stationName, reqs]) => {
                        const stationId = reqs[0].stationId;
                        const currentLevel = stationLevels[stationId] ?? 0;
                        const isHidden = hiddenStations[stationId];

                        return (
                            <div
                                key={stationName}
                                className="bg-card border border-border-color rounded-sm overflow-hidden"
                            >
                                <div className="bg-muted/30 px-3 py-1.5 border-b border-border-color flex justify-between items-center gap-2">
                                    <div className="font-bold text-foreground text-sm truncate">
                                        {stationName}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs shrink-0">
                                        {isHidden && (
                                            <span className="text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-sm font-medium">
                                                Hidden
                                            </span>
                                        )}
                                        <span className="text-muted-foreground font-medium">
                                            Current Lvl {currentLevel}
                                        </span>
                                    </div>
                                </div>
                                <div className="divide-y divide-border-color">
                                    {reqs.map((req, idx) => (
                                        <div
                                            key={idx}
                                            className={`px-3 py-2 flex items-center justify-between transition-colors ${
                                                req.isCompleted
                                                    ? "bg-muted/20 text-muted-foreground"
                                                    : "hover:bg-muted/10"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`text-xs sm:text-sm ${
                                                        req.isCompleted
                                                            ? "text-muted-foreground line-through opacity-70"
                                                            : "text-muted-foreground"
                                                    }`}
                                                >
                                                    Lvl {req.level}
                                                </span>
                                                {req.isCompleted && (
                                                    <span className="text-[10px] text-tarkov-green font-bold bg-tarkov-green/10 px-1.5 py-0.5 rounded-sm">
                                                        Done
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {req.isFir && (
                                                    <span className="px-1.5 py-0.5 text-[10px] bg-orange-500/15 text-orange-500 border border-orange-500/30 rounded-sm font-bold uppercase tracking-wide">
                                                        FIR
                                                    </span>
                                                )}
                                                <span
                                                    className={`font-mono font-semibold text-sm ${
                                                        req.isCompleted
                                                            ? "text-muted-foreground"
                                                            : "text-foreground"
                                                    }`}
                                                >
                                                    {req.count}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="p-8 text-center text-muted-foreground bg-card border border-border-color rounded-sm">
                        No hideout stations require this item.
                    </div>
                )}
            </div>
        </div>
    );
}
