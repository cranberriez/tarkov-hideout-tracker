"use client";

import Image from "next/image";
import { useUserStore } from "@/app/lib/stores/useUserStore";
import type { Station } from "@/app/types";

interface StationCardProps {
    station: Station;
}

export function StationCard({ station }: StationCardProps) {
    const {
        stationLevels,
        setStationLevel,
        hiddenStations,
        toggleHiddenStation,
        compactMode,
        showHidden,
    } = useUserStore();

    const currentLevel = stationLevels[station.id] ?? 0;
    const isHidden = hiddenStations[station.id];
    const maxLevel = station.levels.length;

    const nextLevelData = station.levels.find((l) => l.level === currentLevel + 1);
    const isMaxed = currentLevel >= maxLevel;

    const imageName = station.name.replace(/ /g, "_") + "_Portrait.webp";
    // const imagePath = `/images/hideout/${imageName}`; // Not used in compact design per request, but maybe for icon?
    // User asked for "Add the icon for the station to the left of the name/level"
    // We'll use the same image as an icon.

    // If hidden and showHidden is false, don't render (handled by parent usually, but good safety)
    if (isHidden && !showHidden) return null;

    return (
        <div
            className={`bg-card border border-border-color rounded overflow-hidden flex flex-col transition-opacity ${
                isHidden ? "opacity-50 grayscale" : ""
            }`}
        >
            {/* Header */}
            <div className="px-3 py-3 border-b border-border-color flex justify-between items-center bg-linear-to-r from-card to-transparent">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded overflow-hidden border border-white/10 shrink-0">
                        <Image
                            src={`/images/hideout/${imageName}`}
                            alt={station.name}
                            fill
                            className="object-cover"
                        />
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
                        {isHidden ? (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        ) : (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                <line x1="2" y1="2" x2="22" y2="22" />
                            </svg>
                        )}
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
            <div className="p-3 flex-1 flex flex-col gap-2 bg-card/50">
                {!isMaxed && nextLevelData ? (
                    <>
                        <div className="text-[10px] text-gray-600 uppercase tracking-wider font-bold mb-0.5">
                            Next Level Requires:
                        </div>

                        {compactMode ? (
                            // Compact Grid View
                            <div className="flex flex-wrap gap-2">
                                {nextLevelData.itemRequirements.map((req) => {
                                    const quantity = req.count ?? req.quantity ?? 1;
                                    return (
                                        <div
                                            key={req.id}
                                            className="relative w-12 h-12 bg-black/40 border border-white/10 group"
                                            title={`${quantity}x ${req.item.name}`}
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
                                            <div className="absolute bottom-0 right-0 bg-black/80 px-1 text-[10px] font-mono text-tarkov-green border-t border-l border-white/10">
                                                {quantity}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            // Expanded List View
                            <div className="flex flex-col gap-1.5">
                                {nextLevelData.itemRequirements.map((req) => {
                                    const quantity = req.count ?? req.quantity ?? 1;
                                    return (
                                        <div
                                            key={req.id}
                                            className="flex items-center gap-3 bg-black/20 p-1.5 rounded border border-white/5 hover:border-white/10 transition-colors"
                                        >
                                            <div className="relative w-6 h-6 shrink-0">
                                                {req.item.iconLink && (
                                                    <Image
                                                        src={req.item.iconLink}
                                                        alt={req.item.name}
                                                        fill
                                                        className="object-contain"
                                                        unoptimized
                                                    />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-gray-300 truncate">
                                                    <span className="font-bold text-tarkov-green mr-2 font-mono">
                                                        {quantity}x
                                                    </span>
                                                    {req.item.shortName || req.item.name}
                                                </div>
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
        </div>
    );
}
