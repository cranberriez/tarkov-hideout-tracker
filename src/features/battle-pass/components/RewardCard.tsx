import { Flag, Check, CircleAlert, Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import { type Tile } from "../lib/battle-pass-model";
import { Artwork } from "./ui/Artwork";
import { ActionChip } from "./ui/ActionChip";
import { DocumentIcon } from "./ui/DocumentIcon";
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
	toggleGoal,
	toggleDone,
	configuredCosts,
	editor,
	editing = false,
	costErrors = [],
	costsIncomplete = false,
	requiredTypes,
	onTypeCountChange,
}: {
	tile: Tile;
	span?: "wide" | "tall";
	pageNumber: number;
	done: boolean;
	goal: boolean;
	filler: boolean;
	toggleGoal: () => void;
	toggleDone: () => void;
	configuredCosts: Record<string, number> | null;
	editor?: ReactNode;
	editing?: boolean;
	costErrors?: string[];
	costsIncomplete?: boolean;
	requiredTypes: number;
	onTypeCountChange?: (count: number) => void;
}) {
	const [adjustingTypes, setAdjustingTypes] = useState(false);
	const [typeCount, setTypeCount] = useState("");
	const validTypeCount = /^\d+$/.test(typeCount) && Number(typeCount) >= 1 && Number(typeCount) <= 10;
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
			<div className="contents">
				<div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg bg-surface-raised/30">
					<Artwork
						src={tile.bigImg || tile.img}
						sizes={span === "wide" ? "(min-width: 1100px) 50vw, 100vw" : "(min-width: 1100px) 25vw, 50vw"}
						className={cn(styles.image, "h-full w-full p-2", done && "opacity-50")}
					/>
				</div>
				<div className="contents">
					{filler && !done && !goal && (
						<span className="absolute left-2 top-2 rounded bg-info-surface px-2 py-1 text-[10px] font-medium text-info">
							Suggested
						</span>
					)}
					<div className="absolute right-2 top-2 z-10 flex gap-1">
						<ActionChip
							disabled={editing}
							active={goal}
							tone="goal"
							label={goal ? "Remove goal" : "Set goal"}
							accessibleLabel={`${goal ? "Remove goal" : "Set goal"}: ${label}`}
							onClick={toggleGoal}
							icon={<Flag size={17} fill={goal ? "currentColor" : "none"} />}
						/>
						<ActionChip
							disabled={editing}
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
						<div className="flex shrink-0 items-center gap-1">
							{onTypeCountChange && (
								<button
									type="button"
									className="flex size-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
									aria-label={`Adjust document types: ${tile.displayName}`}
									title="Adjust document types"
									onClick={() => {
										setTypeCount(String(requiredTypes));
										setAdjustingTypes(true);
									}}
								>
									<Settings size={13} aria-hidden />
								</button>
							)}
							{editing && costErrors.length ? (
								<span
									role="alert"
									title={costErrors.join(" · ")}
									className="flex max-w-[60%] items-start gap-1 text-[10px] text-foreground"
								>
									<CircleAlert size={12} className="mt-0.5 shrink-0 text-danger" aria-hidden />
									{costErrors.join(" · ")}
								</span>
							) : (
								<span
									title="Total documents"
									className="flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-subtle-foreground"
								>
									<DocumentIcon className="size-3" />
									{tile.totalDocumentCost} docs
								</span>
							)}
						</div>
					</div>
					{adjustingTypes && onTypeCountChange ? (
						<form
							className="flex h-8 items-center gap-2 text-xs"
							onSubmit={(event) => {
								event.preventDefault();
								if (!validTypeCount) return;
								onTypeCountChange(Number(typeCount));
								setAdjustingTypes(false);
							}}
						>
							<label className="flex min-w-0 items-center gap-2">
								<span className="shrink-0">Document Types:</span>
								<input
									type="number"
									min={1}
									max={10}
									step={1}
									required
									autoFocus
									value={typeCount}
									aria-label={`Document type count: ${tile.displayName}`}
									className="h-8 w-14 min-w-0 rounded border border-border bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-brand"
									onChange={(event) => setTypeCount(event.target.value)}
								/>
							</label>
							<button
								type="submit"
								disabled={!validTypeCount}
								className="ml-auto h-8 cursor-pointer rounded bg-surface-raised px-2 font-medium disabled:opacity-50"
							>
								Done
							</button>
						</form>
					) : (
						editor
					)}
					{configuredCosts && !editing && <CostList costs={configuredCosts} inventory={{}} wide={span === "wide"} />}
					{costsIncomplete && !editing && (
						<p
							className="text-[11px] text-warning"
							title={`Use Setup Costs to enter ${requiredTypes} distinct document types totaling ${tile.totalDocumentCost}. ${costErrors.join(" · ")}`}
						>
							Costs incomplete
						</p>
					)}
				</div>
			</div>
		</article>
	);
}
