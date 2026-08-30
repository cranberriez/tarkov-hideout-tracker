"use client";

import Image from "next/image";
import { Check, EyeOff, PackageOpen } from "lucide-react";

export interface StationRequirementEntry {
    stationName: string;
    stationNormalizedName: string;
    stationId: string;
    stationImageLink?: string;
    stationMaxLevel: number;
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

const HIDEOUT_LEVEL_COUNT = 6;

export function ItemDetailHideoutRequirements({
    selectedItemImageLink,
    stationRequirements,
    stationLevels,
    hiddenStations,
}: ItemDetailHideoutRequirementsProps) {
    if (stationRequirements.length === 0) return null;

    const levels = Array.from({ length: HIDEOUT_LEVEL_COUNT }, (_, index) => index + 1);

    return (
        <div className="overflow-x-auto">
            <div
                role="table"
                aria-label="Hideout station item requirements"
                className="grid w-full"
                style={{
                    gridTemplateColumns: `minmax(148px, 1.5fr) repeat(${HIDEOUT_LEVEL_COUNT}, minmax(76px, 1fr))`,
                }}
            >
                <div
                    role="row"
                    className="col-span-full grid grid-cols-subgrid border-b border-border-color bg-black/15 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                    <div role="columnheader" className="p-2">
                        Station
                    </div>
                    {levels.map((level) => (
                        <div
                            key={level}
                            role="columnheader"
                            className={`p-2 text-left ${
                                level % 2 === 0 ? "bg-white/[0.035]" : ""
                            }`}
                        >
                            Level {level}
                        </div>
                    ))}
                </div>

                {stationRequirements.map(([stationName, reqs]) => {
                    const station = reqs[0];
                    const currentLevel = stationLevels[station.stationId] ?? 0;
                    const isHidden = hiddenStations[station.stationId];
                    const isComplete = reqs.every((req) => req.isCompleted);
                    const requirementsByLevel = new Map<number, StationRequirementEntry[]>();
                    reqs.forEach((requirement) => {
                        const levelRequirements = requirementsByLevel.get(requirement.level) ?? [];
                        levelRequirements.push(requirement);
                        requirementsByLevel.set(requirement.level, levelRequirements);
                    });

                    return (
                        <div
                            key={station.stationId}
                            role="row"
                            className={`col-span-full grid min-h-14 grid-cols-subgrid border-b border-border-color last:border-b-0 ${
                                isComplete ? "bg-tarkov-green/[0.025]" : ""
                            }`}
                        >
                            <div
                                role="cell"
                                className="flex min-w-0 items-center gap-2.5 p-2"
                            >
                                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-white/5">
                                    <Image
                                        src={
                                            station.stationImageLink ??
                                            `/images/hideout/${station.stationNormalizedName}_Portrait.webp`
                                        }
                                        alt=""
                                        fill
                                        className="object-cover"
                                        unoptimized={Boolean(station.stationImageLink)}
                                    />
                                </span>
                                <div className="min-w-0">
                                    <div
                                        className={`truncate text-sm font-medium ${
                                            isComplete
                                                ? "text-muted-foreground"
                                                : "text-foreground"
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

                            {levels.map((level) => (
                                <div
                                    key={level}
                                    role="cell"
                                    className={`flex min-h-11 min-w-0 flex-col items-start justify-center p-2 ${
                                        level % 2 === 0 ? "bg-white/[0.035]" : ""
                                    }`}
                                >
                                    {(requirementsByLevel.get(level) ?? []).map((requirement) => (
                                        <RequirementCell
                                            key={requirement.requirementId}
                                            requirement={requirement}
                                            itemImageLink={selectedItemImageLink}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
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
            className={`flex h-11 items-center justify-start gap-1.5 text-sm ${
                requirement.isCompleted
                    ? "text-muted-foreground"
                    : "text-foreground"
            }`}
        >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.035]">
                {itemImageLink ? (
                    <Image
                        src={itemImageLink}
                        alt=""
                        fill
                        className="object-contain p-0.5"
                        unoptimized
                    />
                ) : (
                    <PackageOpen size={15} className="text-muted-foreground" />
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
            <span className="text-left font-mono font-semibold tabular-nums">
                ×{requirement.count}
            </span>
        </div>
    );
}
