import { Flag, Check } from "lucide-react";
import { totalCost, type Tile, type Costs } from "../lib/battle-pass-model";
import { Artwork } from "./ui/Artwork";
import { ActionChip } from "./ui/ActionChip";
import { CostList } from "./CostList";
import { cn } from "@/lib/utils";
import styles from "../battle-pass.module.css";

export function RewardCard({
	tile,
	span,
	pageNumber,
	done,
	goal,
	filler,
	costs,
	inventory,
	toggleGoal,
	toggleDone,
	possibleFraction,
	previewEnabled,
	ownCost,
	swapCost,
}: {
	tile: Tile;
	span?: "wide" | "tall";
	pageNumber: number;
	done: boolean;
	goal: boolean;
	filler: boolean;
	costs: Costs;
	inventory: Costs;
	toggleGoal: () => void;
	toggleDone: () => void;
	possibleFraction: number;
	previewEnabled: boolean;
	/** `costs` is this reward's own cost rather than a cumulative path. */
	ownCost: boolean;
	/** Edit mode; completed rewards stay locked. */
	swapCost?: (from: string, to: string) => void;
}) {
	const label = `Page ${pageNumber}, ${tile.displayName}`;
	const name = tile.displayName + (tile.rewards[0].type === "tarcoin" ? ` ×${tile.rewards[0].value}` : "");
	return (
		<article
			className={cn(
				styles.card,
				"h-full min-w-0 rounded-lg bg-card",
				span === "wide" && "col-span-2",
				span === "tall" && "row-span-2",
				done && "bg-success/5",
			)}
		>
			<div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg bg-surface-raised/30">
				<Artwork
					src={tile.bigImg || tile.img}
					sizes={span === "wide" ? "(min-width: 1100px) 50vw, 100vw" : "(min-width: 1100px) 25vw, 50vw"}
					className={cn(styles.image, "h-full w-full p-2", done && "opacity-50")}
				/>
			</div>
			<div className="contents">
				{!done && possibleFraction === 1 && (
					<span
						role="img"
						aria-label="Fully covered by owned documents"
						title="Owned documents cover this reward in the preview"
						className="absolute left-2 top-10 z-10 rounded bg-card/90 p-1 text-success"
					>
						<Check size={19} strokeWidth={3} aria-hidden />
					</span>
				)}
				{filler && !done && !goal && (
					<span className="absolute left-2 top-2 rounded bg-info-surface px-2 py-1 text-[10px] font-medium text-info">
						Suggested
					</span>
				)}
				<div className="absolute right-2 top-2 z-10 flex gap-1">
					<ActionChip
						active={goal}
						tone="goal"
						label={goal ? "Remove goal" : "Set goal"}
						accessibleLabel={`${goal ? "Remove goal" : "Set goal"}: ${label}`}
						onClick={toggleGoal}
						icon={<Flag size={17} fill={goal ? "currentColor" : "none"} />}
					/>
					<ActionChip
						active={done}
						tone="done"
						label={done ? "Mark incomplete" : "Complete"}
						accessibleLabel={`${done ? "Mark incomplete" : "Mark completed"}: ${label}`}
						onClick={toggleDone}
						icon={<Check size={19} strokeWidth={done ? 3 : 1.8} />}
					/>
				</div>
			</div>
			<div
				className={cn(
					styles.cardDetails,
					"absolute inset-x-0 bottom-0 space-y-2 rounded-b-lg bg-gradient-to-t from-card/90 via-card/60 to-transparent px-3 pb-2.5 pt-8",
				)}
			>
				<div className="flex items-center justify-between gap-2">
					<h3 title={name} className={cn(styles.cardTitle, "min-w-0 truncate text-base font-semibold")}>
						{name}
					</h3>
					<span title="Total documents" className="shrink-0 text-[11px] tabular-nums text-subtle-foreground">
						{totalCost(costs)}
					</span>
				</div>
				<CostList
					costs={costs}
					inventory={done ? {} : inventory}
					wide={span === "wide"}
					previewEnabled={previewEnabled && !done}
					tileId={ownCost ? tile.id : undefined}
					onSwap={swapCost}
					swapLocked={done}
				/>
			</div>
		</article>
	);
}
