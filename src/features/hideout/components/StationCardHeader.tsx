import Image from "next/image";
import { Lock, Eye, EyeOff } from "lucide-react";
import type { Station } from "@/types";

export interface StationCardHeaderProps {
    station: Station;
    isLocked: boolean;
    isHidden: boolean;
    currentLevel: number;
    maxLevel: number;
    isMaxed: boolean;
    hideRequirements: boolean;
    toggleHiddenStation: (stationId: string) => void;
    onLevelDown: () => void;
    onLevelUp: () => void;
    upgradeStatus: "ready" | "missing" | "illegal";
}

export function StationCardHeader({
    station,
    isLocked,
    isHidden,
    currentLevel,
    maxLevel,
    isMaxed,
    hideRequirements,
    toggleHiddenStation,
    onLevelDown,
    onLevelUp,
    upgradeStatus,
}: StationCardHeaderProps) {
    const iconBorderClass =
        upgradeStatus === "ready"
            ? "border-green-500/60"
            : upgradeStatus === "illegal"
            ? "border-red-500/60"
            : "border-white/10";

    const plusButtonColor =
        upgradeStatus === "ready"
            ? "text-tarkov-green hover:text-green-400"
            : upgradeStatus === "illegal"
            ? "text-red-400 hover:text-red-300"
            : "text-gray-400 hover:text-white";

    return (
        <div
            className={`px-3 py-3 flex justify-between items-center bg-linear-to-r from-card to-muted/75 ${
                hideRequirements ? "" : "border-b border-border-color"
            }`}
        >
            <div className="flex items-center gap-3">
                <div
                    className={`relative w-10 h-10 rounded overflow-hidden border ${iconBorderClass} shrink-0`}
                >
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
                        <span className={currentLevel > 0 ? "text-tarkov-green" : "text-gray-500"}>
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
                        onClick={onLevelDown}
                        disabled={currentLevel === 0}
                        className="px-2 py-1 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors font-mono text-xs"
                        title="Level Down"
                    >
                        -
                    </button>
                    <div className="w-px h-3 bg-white/10"></div>
                    <button
                        onClick={onLevelUp}
                        disabled={isMaxed}
                        className={`px-2 py-1 ${plusButtonColor} hover:bg-white/5 disabled:opacity-30 transition-colors font-mono text-xs`}
                        title="Level Up"
                    >
                        +
                    </button>
                </div>
            </div>
        </div>
    );
}
