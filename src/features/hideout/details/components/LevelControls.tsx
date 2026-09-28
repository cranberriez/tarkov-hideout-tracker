"use client";

import { useState } from "react";
import { ArrowUp, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import type { StationUpgradeStatus } from "../../station-model";
import { useStationLevelChange } from "../../useStationLevelChange";

/**
 * Saved-level controls: level and progress pips, a full-width build action, and status.
 * "Update item counts" is page-local and defaults on each visit.
 */
export function LevelControls({
	station,
	itemById,
	upgradeStatus,
}: {
	station: Station;
	itemById: Readonly<Record<string, ItemSummary>>;
	upgradeStatus: StationUpgradeStatus;
}) {
	const [adjustItems, setAdjustItems] = useState(true);
	const { currentLevel, maxLevel, canLevelUp, canLevelDown, hasUnresolvedNextLevelItem, levelUp, levelDown } =
		useStationLevelChange(station, itemById);
	const isMaxed = currentLevel >= maxLevel;
	const ready = !isMaxed && upgradeStatus === "ready";
	const itemHint = adjustItems ? " and update item counts" : "";
	const status = isMaxed
		? { label: "Fully upgraded", className: "text-success" }
		: upgradeStatus === "illegal"
			? { label: `Level ${currentLevel} prerequisites are no longer met`, className: "text-danger" }
			: ready
				? { label: `Everything for level ${currentLevel + 1} is ready`, className: "text-success" }
				: { label: `Level ${currentLevel + 1} still has missing requirements`, className: "text-muted-foreground" };

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-baseline gap-2">
					<span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Level</span>
					<span className="font-mono text-xl leading-none text-foreground">
						{currentLevel}
						<span className="text-sm text-muted-foreground">/{maxLevel}</span>
					</span>
				</div>
				<div className="flex gap-1" aria-hidden="true">
					{Array.from({ length: maxLevel }, (_, index) => (
						<span
							key={index}
							className={cn(
								"h-1.5 w-5 rounded-full",
								index < currentLevel
									? "bg-brand"
									: index === currentLevel && ready
										? "bg-brand/35"
										: "bg-highlight/10",
							)}
						/>
					))}
				</div>
			</div>
			<div className="flex items-center gap-2">
				<Button
					iconOnly
					onClick={() => levelDown(adjustItems)}
					disabled={!canLevelDown}
					aria-label={`Lower ${station.name} to level ${Math.max(0, currentLevel - 1)}`}
					title={`Level down${itemHint}`}
				>
					<Minus size={14} />
				</Button>
				<Button
					variant={ready ? "solid" : "soft"}
					tone={ready ? "brand" : upgradeStatus === "illegal" ? "danger" : "neutral"}
					className="flex-1"
					onClick={() => levelUp(adjustItems)}
					disabled={!canLevelUp}
					aria-label={isMaxed ? "Maximum level reached" : `Raise ${station.name} to level ${currentLevel + 1}`}
					title={
						hasUnresolvedNextLevelItem
							? "Level up unavailable while required item data is missing"
							: `Level up${itemHint}`
					}
				>
					{!isMaxed && <ArrowUp size={14} />}
					{isMaxed ? "Max level" : `Build level ${currentLevel + 1}`}
				</Button>
			</div>
			<p className={cn("text-xs leading-snug", status.className)}>{status.label}</p>
			<label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
				<input
					type="checkbox"
					checked={adjustItems}
					onChange={(event) => setAdjustItems(event.target.checked)}
					className="size-3.5 accent-brand"
				/>
				Update item counts when changing level
			</label>
		</div>
	);
}
