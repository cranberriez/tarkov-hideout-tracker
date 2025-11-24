"use client";

import Image from "next/image";
import { useUserStore } from "@/app/lib/stores/useUserStore";
import type { Station } from "@/app/types";
import { useMemo } from "react";

interface StationCardProps {
    station: Station;
}

export function StationCard({ station }: StationCardProps) {
    const { stationLevels, incrementStationLevel, setStationLevel } = useUserStore();
    const currentLevel = stationLevels[station.id] ?? 0;

    // Determine max level from the data
    const maxLevel = station.levels.length;

    // Get next level requirements
    // levels are usually 1-indexed in the data?
    // e.g. levels[0] is level 1.
    // So if currentLevel is 0, next level is levels[0] (level 1).
    // If currentLevel is 1, next level is levels[1] (level 2).
    const nextLevelData = station.levels.find((l) => l.level === currentLevel + 1);
    const isMaxed = currentLevel >= maxLevel;

    const imageName = station.name.replace(/ /g, "_") + "_Portrait.webp";
    const imagePath = `/images/hideout/${imageName}`;

    return (
        <div className="bg-card border border-border-color rounded-md overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-border-color flex justify-between items-start bg-gradient-to-r from-card to-transparent">
                <div>
                    <h3 className="font-bold text-lg text-foreground">{station.name}</h3>
                    <div className="text-xs text-gray-500 mt-1 font-mono">
                        LEVEL{" "}
                        <span className={currentLevel > 0 ? "text-tarkov-green" : "text-gray-500"}>
                            {currentLevel}
                        </span>{" "}
                        <span className="text-gray-600">/</span> {maxLevel}
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <button
                        onClick={() =>
                            setStationLevel(station.id, Math.min(maxLevel, currentLevel + 1))
                        }
                        disabled={isMaxed}
                        className="p-1 hover:bg-white/5 rounded disabled:opacity-30 text-gray-400 hover:text-white transition-colors"
                        title="Level Up"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                    </button>
                    <button
                        onClick={() => setStationLevel(station.id, Math.max(0, currentLevel - 1))}
                        disabled={currentLevel === 0}
                        className="p-1 hover:bg-white/5 rounded disabled:opacity-30 text-gray-400 hover:text-white transition-colors"
                        title="Level Down"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col gap-4 relative">
                {/* Background Image (optional, low opacity) */}
                {/* <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <Image src={imagePath} alt={station.name} fill className="object-cover" />
                </div> */}

                {!isMaxed && nextLevelData ? (
                    <>
                        <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">
                            Next Level Requires:
                        </div>
                        <div className="flex flex-col gap-2">
                            {nextLevelData.itemRequirements.map((req) => {
                                const quantity = req.count ?? req.quantity ?? 1;
                                return (
                                    <div
                                        key={req.id}
                                        className="flex items-center gap-3 bg-black/20 p-2 rounded border border-white/5 hover:border-white/10 transition-colors"
                                    >
                                        <div className="relative w-8 h-8 bg-black/40 rounded flex-shrink-0 border border-white/5">
                                            {req.item.iconLink && (
                                                <Image
                                                    src={req.item.iconLink}
                                                    alt={req.item.name}
                                                    fill
                                                    className="object-contain p-0.5"
                                                    unoptimized // External images from tarkov.dev often need unoptimized or configured domains
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-gray-300 truncate">
                                                <span className="font-bold text-tarkov-green mr-2">
                                                    {quantity}x
                                                </span>
                                                {req.item.shortName || req.item.name}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm italic py-8">
                        Max level reached
                    </div>
                )}
            </div>
        </div>
    );
}
