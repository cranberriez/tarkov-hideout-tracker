import Image from "next/image";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import type { Station } from "@/types/hideout";
import { cn } from "@/lib/utils";

/** Station portrait; a missing API image shows an explicit placeholder. */
export function StationImage({ station, size = 40, locked = false, className }: {
    station: Pick<Station, "name" | "normalizedName" | "imageLink">;
    size?: number;
    locked?: boolean;
    className?: string;
}) {
    return (
        <div className={cn("relative shrink-0 overflow-hidden rounded border border-highlight/10", className)} style={{ width: size, height: size }}>
            {station.imageLink ? (
                <Image src={station.imageLink} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized />
            ) : (
                <span aria-hidden="true" className="flex size-full items-center justify-center bg-highlight/5 font-semibold text-subtle-foreground">
                    {station.name.slice(0, 1)}
                </span>
            )}
            {locked && (
                <div className="absolute inset-0 flex items-center justify-center bg-shadow/75">
                    <Lock size={Math.round(size * 0.4)} aria-label="Locked" />
                </div>
            )}
        </div>
    );
}

/** Portrait, name, and the player's saved level. `name` may be a link. */
export function StationIdentity({ station, name, currentLevel, maxLevel, locked = false, imageClassName, headingLevel: Heading = "h3", size = "sm" }: {
    station: Station;
    name?: ReactNode;
    currentLevel: number;
    maxLevel: number;
    locked?: boolean;
    imageClassName?: string;
    headingLevel?: "h1" | "h2" | "h3";
    size?: "sm" | "lg";
}) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <StationImage station={station} size={size === "lg" ? 64 : 40} locked={locked} className={imageClassName} />
            <div className="min-w-0">
                <Heading className={cn("truncate font-bold leading-tight text-foreground", size === "lg" ? "text-2xl sm:text-3xl" : "text-base")}>
                    {name ?? station.name}
                </Heading>
                <div className={cn("mt-0.5 font-mono text-subtle-foreground", size === "lg" ? "text-xs" : "text-[10px]")}>
                    LEVEL{" "}
                    <span className={currentLevel > 0 ? "text-brand" : "text-subtle-foreground"}>{currentLevel}</span>{" "}
                    <span className="text-subtle-foreground">/</span> {maxLevel}
                </div>
            </div>
        </div>
    );
}
