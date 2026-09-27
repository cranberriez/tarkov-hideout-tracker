import Image from "next/image";
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

