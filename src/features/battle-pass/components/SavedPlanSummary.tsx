"use client";

import { useState, type ReactNode } from "react";
import { CircleAlert, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { DESTINATION_PRESETS } from "./DestinationPicker";
import { Artwork } from "./ui/Artwork";
import { flatField } from "./ui/field";

const savedDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** Compact read-out of the saved plan being followed, with a way back to configuring. */
export function SavedPlanSummary() {
	const { tiles } = useBattlePassData();
	const { locked, lockedStatus, lockedGathering, result, route, profiles, reconfigure } = useBattlePassPlanContext();
	if (!locked) return null;

	const preset = DESTINATION_PRESETS[locked.destination as keyof typeof DESTINATION_PRESETS];
	const tile = preset ? null : tiles.find((entry) => entry.id === locked.destination);
	const owner = locked.claims[0]?.profileKey;
	const profileLabel = locked.allProfiles
		? "All profiles"
		: (route?.claims[0]?.profileLabel ??
			profiles.find((profile) => profile.key === owner)?.label ??
			"Selected profile");
	const saved = locked.savedAt ? new Date(locked.savedAt) : null;
	const offPlan = lockedStatus?.kind === "ok" ? lockedStatus.offPlan.length : 0;
	const warnings = [
		lockedStatus?.kind === "broken" && lockedStatus.reason,
		offPlan > 0 &&
			`You claimed ${offPlan} ${offPlan === 1 ? "reward" : "rewards"} the plan didn't include. The plan still follows its own claims; re-optimize to account for them.`,
		typeof result !== "string" &&
			result.additionalClassified > locked.shortfall &&
			"You need more documents than when this plan was saved.",
	].filter((warning): warning is string => !!warning);

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-end gap-x-6 gap-y-3">
				<Item label="Destination">
					<span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
						{preset ? (
							<preset.Icon className="size-4" aria-hidden />
						) : tile ? (
							<Artwork src={tile.img} className="size-5" />
						) : (
							<TriangleAlert className="size-4 text-warning" aria-hidden />
						)}
					</span>
					<span className="min-w-0 truncate">{preset?.label ?? tile?.displayName ?? "Unavailable goal"}</span>
				</Item>
				{locked.destination !== "owned" && (
					<Item label="Rewards">{locked.buyAll ? "All through destination" : "Required"}</Item>
				)}
				<Item label="Profiles">{profileLabel}</Item>
				{locked.useClassified && <Item label="Classified">Uses classified</Item>}
				<Item label="Gathering">{lockedGathering > 0 ? `Gather ${lockedGathering} more` : "No gathering"}</Item>
				{lockedStatus?.kind === "ok" && (
					<Item label="Progress">
						<span className="tabular-nums">
							{lockedStatus.completedCount} of {locked.claims.length} claimed
						</span>
					</Item>
				)}
				{saved && !Number.isNaN(saved.getTime()) && (
					<Item label="Saved">
						<time dateTime={locked.savedAt}>{savedDate.format(saved)}</time>
					</Item>
				)}
				<button
					type="button"
					onClick={reconfigure}
					className={cn(flatField, "ml-auto inline-flex items-center gap-2 font-medium")}
				>
					<SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
					Reconfigure
				</button>
			</div>
			{warnings.length > 0 && (
				<ul className="space-y-1.5">
					{warnings.map((warning) => (
						<li key={warning} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-warning">
							<CircleAlert className="size-3.5 shrink-0" aria-hidden />
							<span className="min-w-0">{warning}</span>
							<Button size="xs" variant="ghost" tone="brand" onClick={reconfigure}>
								Re-optimize
							</Button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function Item({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid min-w-0 gap-0.5">
			<span className="text-xs font-medium text-muted-foreground">{label}</span>
			<span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">{children}</span>
		</div>
	);
}

/** Footer of the route configuration: save the route as a plan, or leave reconfiguring. */
export function SavePlanBar() {
	const {
		canSave,
		unchanged,
		savePlan,
		hasSavedPlan,
		reconfiguring,
		cancelReconfigure,
		discardPlan,
		result,
		calculating,
	} = useBattlePassPlanContext();
	const [confirming, setConfirming] = useState(false);
	const replacing = reconfiguring && hasSavedPlan;
	const blocked = canSave
		? undefined
		: typeof result === "string" && !calculating
			? "Set up a route before saving"
			: "Wait for the route to finish calculating";
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-highlight/[0.05] pt-4">
			{replacing && unchanged ? (
				<Button tone="brand" variant="solid" size="md" onClick={cancelReconfigure}>
					No changes, close
				</Button>
			) : (
				<>
					<span
						title={blocked ?? "Locks this route in. It follows your progress without re-optimizing."}
						className="inline-flex"
					>
						<Button tone="brand" variant="solid" size="md" disabled={!canSave} onClick={savePlan}>
							{replacing ? "Replace saved plan" : "Save plan"}
						</Button>
					</span>
					{replacing && (
						<Button size="md" onClick={cancelReconfigure}>
							Cancel
						</Button>
					)}
				</>
			)}
			<span className="min-w-0 flex-1 basis-56" />
			{replacing && unchanged && <span className="sr-only">This matches your saved plan.</span>}
			{replacing && (
				<span className="flex items-center gap-1">
					{confirming && (
						<Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>
							Keep plan
						</Button>
					)}
					<Button
						size="xs"
						variant="ghost"
						tone="danger"
						onClick={() => {
							if (!confirming) return setConfirming(true);
							discardPlan();
							setConfirming(false);
						}}
					>
						{confirming ? "Confirm discard" : "Discard saved plan"}
					</Button>
				</span>
			)}
		</div>
	);
}
