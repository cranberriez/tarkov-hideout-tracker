import Image from "next/image";
import { Lock, Eye, EyeOff } from "lucide-react";
import type { Station } from "@/types/hideout";

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
    hasUnresolvedItemData: boolean;
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
    hasUnresolvedItemData,
}: StationCardHeaderProps) {
    const iconBorderClass =
        upgradeStatus === "ready"
            ? "border-success/60"
            : upgradeStatus === "illegal"
            ? "border-danger/60"
            : "border-highlight/10";

    const plusButtonColor =
        upgradeStatus === "ready"
            ? "text-success hover:text-success"
            : upgradeStatus === "illegal"
            ? "text-danger hover:text-danger"
            : "text-muted-foreground hover:text-foreground";

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
                        <div className="absolute inset-0 bg-shadow/75 flex items-center justify-center">
                            <Lock size={16} />
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="font-bold text-base text-foreground leading-tight">
                        {station.name}
                    </h3>
                    <div className="text-[10px] text-subtle-foreground font-mono mt-0.5">
                        LEVEL{" "}
                        <span className={currentLevel > 0 ? "text-brand" : "text-subtle-foreground"}>
                            {currentLevel}
                        </span>{" "}
                        <span className="text-subtle-foreground">/</span> {maxLevel}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Visibility Toggle */}
                <button
                    onClick={() => toggleHiddenStation(station.id)}
                    className="p-1 text-subtle-foreground hover:text-foreground transition-colors mr-1"
                    title={isHidden ? "Show Station" : "Hide Station"}
                >
                    {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>

                {/* Level Controls */}
                <div className="flex items-center bg-shadow/20 rounded border border-highlight/5">
                    <button
                        onClick={onLevelDown}
                        disabled={currentLevel === 0}
                        className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-highlight/5 disabled:opacity-30 transition-colors font-mono text-xs"
                        title="Level Down"
                    >
                        -
                    </button>
                    <div className="w-px h-3 bg-highlight/10"></div>
                    <button
                        onClick={onLevelUp}
                        disabled={isMaxed || hasUnresolvedItemData}
                        className={`px-2 py-1 ${plusButtonColor} hover:bg-highlight/5 disabled:opacity-30 transition-colors font-mono text-xs`}
                        title={
                            hasUnresolvedItemData
                                ? "Level up unavailable while required item data is missing"
                                : "Level Up"
                        }
                    >
                        +
                    </button>
                </div>
            </div>
        </div>
    );
}
