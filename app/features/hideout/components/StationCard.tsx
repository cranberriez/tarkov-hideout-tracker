"use client";

import Image from "next/image";
import { CircleCheckBig, Eye, EyeOff, Lock, LockOpen, Check } from "lucide-react";
import { useUserStore } from "@/app/lib/stores/useUserStore";
import { useDataStore } from "@/app/lib/stores/useDataStore";
import { formatNumber } from "@/app/lib/utils/format-number";
import type { Station } from "@/app/types";

interface StationCardProps {
    station: Station;
    isLocked?: boolean;
}

export function StationCard({ station, isLocked = false }: StationCardProps) {
    const {
        stationLevels,
        setStationLevel,
        hiddenStations,
        toggleHiddenStation,
        compactMode,
        showHidden,
        completedRequirements,
        toggleRequirement,
        hideMoney,
        hideRequirements,
    } = useUserStore();

    const { stations } = useDataStore();

    const currentLevel = stationLevels[station.id] ?? 0;
    const isHidden = hiddenStations[station.id];
    const maxLevel = station.levels.length;

    const nextLevelData = station.levels.find((l) => l.level === currentLevel + 1);
    const isMaxed = currentLevel >= maxLevel;

    // If hidden and showHidden is false, don't render (handled by parent usually, but good safety)
    if (isHidden && !showHidden) return null;

    return (
        <div
            className={`bg-card border border-border-color rounded overflow-hidden flex flex-col transition-opacity ${
                isHidden ? "opacity-50 grayscale" : ""
            }`}
        >
            {/* Header */}
            <div
                className={`px-3 py-3 flex justify-between items-center bg-linear-to-r from-card to-transparent ${
                    hideRequirements ? "" : "border-b border-border-color"
                }`}
            >
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded overflow-hidden border border-white/10 shrink-0">
                        {station.imageLink ? (
                            <Image
                                src={station.imageLink}
                                alt={station.name}
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        ) : (
                            // Fallback to local image based on normalized name if api image missing (or just as a safe default)
                            <Image
                                src={`/images/hideout/${station.normalizedName}_Portrait.webp`}
                                alt={station.name}
                                fill
                                className="object-cover"
                                onError={(e) => {
                                    // Fallback if file not found - could set a placeholder
                                    (e.target as HTMLImageElement).style.display = "none";
                                }}
                            />
                        )}
                        {isLocked && (
                            <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                                <Lock size={16} />
                            </div>
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-base text-foreground leading-tight">
                            {station.name}
                        </h3>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                            LEVEL{" "}
                            <span
                                className={currentLevel > 0 ? "text-tarkov-green" : "text-gray-500"}
                            >
                                {currentLevel}
                            </span>{" "}
                            <span className="text-gray-600">/</span> {maxLevel}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Visibility Toggle */}
                    <button
                        onClick={() => toggleHiddenStation(station.id)}
                        className="p-1 text-gray-500 hover:text-white transition-colors mr-1"
                        title={isHidden ? "Show Station" : "Hide Station"}
                    >
                        {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>

                    {/* Level Controls */}
                    <div className="flex items-center bg-black/20 rounded border border-white/5">
                        <button
                            onClick={() =>
                                setStationLevel(station.id, Math.max(0, currentLevel - 1))
                            }
                            disabled={currentLevel === 0}
                            className="px-2 py-1 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors font-mono text-xs"
                            title="Level Down"
                        >
                            -
                        </button>
                        <div className="w-[1px] h-3 bg-white/10"></div>
                        <button
                            onClick={() =>
                                setStationLevel(station.id, Math.min(maxLevel, currentLevel + 1))
                            }
                            disabled={isMaxed}
                            className="px-2 py-1 text-tarkov-green hover:text-green-400 hover:bg-white/5 disabled:opacity-30 transition-colors font-mono text-xs"
                            title="Level Up"
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {!hideRequirements && (
                <div className="p-3 flex-1 flex flex-col gap-2 bg-card/50 relative">
                    {!isMaxed && nextLevelData ? (
                        <>
                            <div className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-0.5">
                                Next Level Requires:
                            </div>

                            {/* Non-Item Requirements (Stations, Skills, Traders) */}
                            <div className="flex flex-wrap gap-2 mb-1">
                                {nextLevelData.stationLevelRequirements
                                    ?.filter(
                                        (req) =>
                                            req.station.normalizedName !== station.normalizedName
                                    )
                                    .map((req, idx) => {
                                        const reqStation = stations?.find(
                                            (s) => s.normalizedName === req.station.normalizedName
                                        );
                                        const reqStationLevel = reqStation
                                            ? stationLevels[reqStation.id] ?? 0
                                            : 0;
                                        const isMet = reqStationLevel >= req.level;

                                        return (
                                            <div
                                                key={`st-${idx}`}
                                                className={`flex items-center gap-2 px-2 py-1 rounded border ${
                                                    isMet
                                                        ? "bg-green-900/20 border-green-500/20"
                                                        : "bg-red-900/20 border-red-500/20"
                                                }`}
                                            >
                                                {isMet ? (
                                                    <Lock size={12} className={"text-green-400"} />
                                                ) : (
                                                    <LockOpen
                                                        size={12}
                                                        className={"text-red-400"}
                                                    />
                                                )}

                                                <span
                                                    className={`text-[10px] font-medium uppercase ${
                                                        isMet ? "text-green-200" : "text-red-200"
                                                    }`}
                                                >
                                                    {req.station.normalizedName.replace(/-/g, " ")}{" "}
                                                    <span className="text-white ml-1">
                                                        LVL {req.level}
                                                    </span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                {nextLevelData.skillRequirements?.map((req, idx) => (
                                    <div
                                        key={`sk-${idx}`}
                                        className="flex items-center gap-2 bg-blue-900/20 border border-blue-500/20 px-2 py-1 rounded"
                                    >
                                        <div className="w-3 h-3 relative shrink-0">
                                            {req.skill.imageLink && (
                                                <Image
                                                    src={req.skill.imageLink}
                                                    alt={req.skill.name}
                                                    fill
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            )}
                                        </div>
                                        <span className="text-[10px] text-blue-200 font-medium uppercase">
                                            {req.skill.name}{" "}
                                            <span className="text-white ml-1">LVL {req.level}</span>
                                        </span>
                                    </div>
                                ))}
                                {nextLevelData.traderRequirements?.map((req, idx) => (
                                    <div
                                        key={`tr-${idx}`}
                                        className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-500/20 px-2 py-1 rounded"
                                    >
                                        <div className="w-3 h-3 relative shrink-0 rounded-full overflow-hidden">
                                            {req.trader.imageLink && (
                                                <Image
                                                    src={req.trader.imageLink}
                                                    alt={req.trader.name}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                />
                                            )}
                                        </div>
                                        <span className="text-[10px] text-yellow-200 font-medium uppercase">
                                            {req.trader.name}{" "}
                                            <span className="text-white ml-1">LL{req.value}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {compactMode ? (
                                // Compact Grid View
                                <div className="flex flex-wrap gap-2">
                                    {nextLevelData.itemRequirements
                                        .filter((req) => {
                                            if (!hideMoney) return true;
                                            const norm = req.item.normalizedName;
                                            return (
                                                norm !== "roubles" &&
                                                norm !== "dollars" &&
                                                norm !== "euros"
                                            );
                                        })
                                        .map((req) => {
                                            const quantity = req.count ?? req.quantity ?? 1;
                                            const isFir = req.attributes.some(
                                                (a) =>
                                                    a.name === "found_in_raid" && a.value === "true"
                                            );
                                            const isCompleted = completedRequirements[req.id];

                                            return (
                                                <div
                                                    key={req.id}
                                                    onClick={() => toggleRequirement(req.id)}
                                                    className={`relative w-12 h-12 bg-black/40 border group cursor-pointer transition-all ${
                                                        isFir
                                                            ? "border-orange-500"
                                                            : "border-white/10"
                                                    } ${
                                                        isCompleted
                                                            ? "opacity-50 grayscale"
                                                            : "hover:border-white/30"
                                                    }`}
                                                    title={`${formatNumber(quantity)}x ${
                                                        req.item.name
                                                    }${isFir ? " (Found In Raid)" : ""}${
                                                        isCompleted ? " (Completed)" : ""
                                                    }`}
                                                >
                                                    {req.item.iconLink && (
                                                        <Image
                                                            src={req.item.iconLink}
                                                            alt={req.item.name}
                                                            fill
                                                            className="object-contain p-1"
                                                            unoptimized
                                                        />
                                                    )}
                                                    {isFir && (
                                                        <div
                                                            className="absolute -top-1.5 -right-1.5 bg-black rounded-full z-10 text-orange-500"
                                                            title="Found In Raid"
                                                        >
                                                            <CircleCheckBig className="w-3.5 h-3.5 text-orange-500" />
                                                        </div>
                                                    )}
                                                    {isCompleted && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                            <Check size={16} />
                                                        </div>
                                                    )}
                                                    <div
                                                        className={`absolute bottom-0 right-0 bg-black/80 px-1 text-[11px] font-mono ${
                                                            isFir
                                                                ? "text-orange-300"
                                                                : "text-tarkov-green"
                                                        } border-t border-l border-white/10`}
                                                    >
                                                        {formatNumber(quantity)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                // Expanded List View
                                <div className="flex flex-col gap-1.5">
                                    {nextLevelData.itemRequirements
                                        .filter((req) => {
                                            if (!hideMoney) return true;
                                            const norm = req.item.normalizedName;
                                            return (
                                                norm !== "roubles" &&
                                                norm !== "dollars" &&
                                                norm !== "euros"
                                            );
                                        })
                                        .map((req) => {
                                            const quantity = req.count ?? req.quantity ?? 1;
                                            const isFir = req.attributes.some(
                                                (a) =>
                                                    a.name === "found_in_raid" && a.value === "true"
                                            );
                                            const isCompleted = completedRequirements[req.id];

                                            return (
                                                <div
                                                    key={req.id}
                                                    onClick={() => toggleRequirement(req.id)}
                                                    className={`flex items-center gap-3 bg-black/20 p-1.5 border transition-colors cursor-pointer ${
                                                        isCompleted
                                                            ? "border-green-500/30 opacity-60 bg-green-900/5"
                                                            : "border-white/5 hover:border-white/10"
                                                    }`}
                                                >
                                                    <div
                                                        className={`relative w-8 h-8 shrink-0 ${
                                                            isFir ? "ring-1 ring-orange-500" : ""
                                                        }`}
                                                    >
                                                        {req.item.iconLink && (
                                                            <Image
                                                                src={req.item.iconLink}
                                                                alt={req.item.name}
                                                                fill
                                                                className={`object-contain ${
                                                                    isCompleted ? "grayscale" : ""
                                                                }`}
                                                                unoptimized
                                                            />
                                                        )}
                                                        {isCompleted && (
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <Check size={16} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 flex items-center justify-between">
                                                        <div
                                                            className={`text-xs truncate ${
                                                                isCompleted
                                                                    ? "text-gray-500 line-through decoration-tarkov-green/50"
                                                                    : "text-gray-300"
                                                            }`}
                                                        >
                                                            <span
                                                                className={`font-bold mr-2 font-mono ${
                                                                    isCompleted
                                                                        ? "text-gray-600"
                                                                        : "text-tarkov-green"
                                                                }`}
                                                            >
                                                                {formatNumber(quantity)}x
                                                            </span>
                                                            {req.item.shortName || req.item.name}
                                                        </div>
                                                        {isFir && !isCompleted && (
                                                            <div
                                                                className="text-orange-500"
                                                                title="Found In Raid"
                                                            >
                                                                <CircleCheckBig className="w-4 h-4" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-600 text-xs italic py-4">
                            Max level reached
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
