import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Station } from "@/types/hideout";
import { stationHref } from "@/lib/entity-routes";
import { StationIdentity } from "./StationIdentity";

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

	return (
		<div
			className={`px-3 py-3 flex justify-between items-center bg-linear-to-r from-card to-muted/75 ${
				hideRequirements ? "" : "border-b border-border-color"
			}`}
		>
			<StationIdentity
				station={station}
				currentLevel={currentLevel}
				maxLevel={maxLevel}
				locked={isLocked}
				imageClassName={iconBorderClass}
				name={
					<Link
						href={stationHref(station.id)}
						className="inline-flex items-center gap-0.5 rounded-xs transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
					>
						{station.name}
						<ArrowUpRight size={13} aria-hidden="true" className="shrink-0" />
					</Link>
				}
			/>

			<div className="flex items-center gap-2">
				<Button
					variant="ghost"
					iconOnly
					size="xs"
					onClick={() => toggleHiddenStation(station.id)}
					aria-pressed={isHidden}
					aria-label={isHidden ? `Show ${station.name}` : `Hide ${station.name}`}
					title={isHidden ? "Show station" : "Hide station"}
				>
					{isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
				</Button>

				<div
					className="flex items-center rounded-sm border border-highlight/10 bg-shadow/20"
					role="group"
					aria-label={`${station.name} level`}
				>
					<Button
						variant="ghost"
						iconOnly
						size="xs"
						onClick={onLevelDown}
						disabled={currentLevel === 0}
						aria-label={`Lower ${station.name} to level ${Math.max(0, currentLevel - 1)}`}
						title="Level down"
						className="rounded-none"
					>
						<Minus size={14} />
					</Button>
					<div className="h-3 w-px bg-highlight/10" />
					<Button
						variant="ghost"
						tone={upgradeStatus === "ready" ? "success" : upgradeStatus === "illegal" ? "danger" : "neutral"}
						iconOnly
						size="xs"
						onClick={onLevelUp}
						disabled={isMaxed || hasUnresolvedItemData}
						aria-label={`Raise ${station.name} to level ${currentLevel + 1}`}
						title={hasUnresolvedItemData ? "Level up unavailable while required item data is missing" : "Level up"}
						className="rounded-none"
					>
						<Plus size={14} />
					</Button>
				</div>
			</div>
		</div>
	);
}
