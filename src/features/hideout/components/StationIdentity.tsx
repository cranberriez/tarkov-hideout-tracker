export { StationImage } from "@/components/entities/station-image";
import type { ReactNode } from "react";
import { StationImage } from "@/components/entities/station-image";
import type { Station } from "@/types/hideout";
import { cn } from "@/lib/utils";

/** Portrait, name, and the player's saved level. `name` may be a link. */
export function StationIdentity({
	station,
	name,
	currentLevel,
	maxLevel,
	locked = false,
	goalLevel,
	imageClassName,
	headingLevel: Heading = "h3",
	size = "sm",
}: {
	station: Station;
	name?: ReactNode;
	currentLevel: number;
	maxLevel: number;
	locked?: boolean;
	/** Shown when the player's station goal stops below `maxLevel`. */
	goalLevel?: number;
	imageClassName?: string;
	headingLevel?: "h1" | "h2" | "h3";
	size?: "sm" | "lg";
}) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			<StationImage station={station} size={size === "lg" ? 64 : 40} locked={locked} className={imageClassName} />
			<div className="min-w-0">
				<Heading
					className={cn(
						"truncate font-bold leading-tight text-foreground",
						size === "lg" ? "text-2xl sm:text-3xl" : "text-base",
					)}
				>
					{name ?? station.name}
				</Heading>
				<div className={cn("mt-0.5 font-mono text-subtle-foreground", size === "lg" ? "text-xs" : "text-[10px]")}>
					LEVEL <span className={currentLevel > 0 ? "text-brand" : "text-subtle-foreground"}>{currentLevel}</span>{" "}
					<span className="text-subtle-foreground">/</span> {maxLevel}
					{goalLevel !== undefined && (
						<span className="text-warning" title="Station goal">
							{" "}
							· {goalLevel === 0 ? "IGNORED" : `GOAL ${goalLevel}`}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
