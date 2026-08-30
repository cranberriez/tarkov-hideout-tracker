"use client";

import { Check, EyeOff, Warehouse } from "lucide-react";

export interface StationRequirementEntry {
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
    selectedItemImageLink?: string;
    stationRequirements: [string, StationRequirementEntry[]][];
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
}

export function ItemDetailHideoutRequirements({
    selectedItemImageLink,
    stationRequirements,
    stationLevels,
    hiddenStations,
}: ItemDetailHideoutRequirementsProps) {
    if (stationRequirements.length === 0) return null;

    return (
        <div className="divide-y divide-border-color">
            {stationRequirements.map(([stationName, reqs]) => {
                const stationId = reqs[0].stationId;
                const currentLevel = stationLevels[stationId] ?? 0;
                const isHidden = hiddenStations[stationId];
                const isComplete = reqs.every((req) => req.isCompleted);

                return (
                    <div
                        key={stationName}
                        className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 ${
                            isComplete ? "bg-tarkov-green/[0.025]" : ""
                        }`}
                    >
                        <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/5 text-muted-foreground">
                                <Warehouse size={15} />
                            </span>
                            <div className="min-w-0">
                                <div
                                    className={`truncate text-sm font-medium ${
                                        isComplete ? "text-muted-foreground" : "text-foreground"
                                    }`}
                                >
                                    {stationName}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <span>Current {currentLevel}</span>
                                    {isHidden && (
                                        <span className="flex items-center gap-0.5 text-red-300">
                                            <EyeOff size={9} /> Hidden
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                            {reqs.map((req) => (
                                <RequirementCell
                                    key={req.requirementId}
                                    requirement={req}
                                    itemImageLink={selectedItemImageLink}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function RequirementCell({
    requirement,
    itemImageLink,
}: {
    requirement: StationRequirementEntry;
    itemImageLink?: string;
}) {
    return (
        <div
            className={`flex h-11 w-[7.5rem] items-center justify-end gap-1.5 text-sm ${
                requirement.isCompleted
                    ? "text-muted-foreground"
                    : "text-foreground"
            }`}
        >
            <span className="w-7 shrink-0 text-center text-xs text-muted-foreground">
                L{requirement.level}
            </span>
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.035]">
                {itemImageLink ? (
                    <img src={itemImageLink} alt="" className="h-9 w-9 object-contain" />
                ) : (
                    <Warehouse size={15} className="text-muted-foreground" />
                )}
                {requirement.isFir && (
                    <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-background bg-orange-400" />
                )}
                {requirement.isCompleted && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-background bg-tarkov-green text-black shadow-sm">
                        <Check size={10} strokeWidth={3} />
                    </span>
                )}
            </span>
            <span className="min-w-8 text-left font-mono font-semibold tabular-nums">
                ×{requirement.count}
            </span>
        </div>
    );
}
