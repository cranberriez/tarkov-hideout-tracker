"use client";

import type { useDocumentInventory } from "../useDocumentInventory";
import { CALCULATING_ROUTE } from "../useDocumentRoute";
import { Toggle } from "./ui/Toggle";
import { CircleAlert, CircleCheck, Layers3, LoaderCircle } from "lucide-react";
import { RouteSummary } from "./RouteSummary";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { FundingInputs, RouteFundingPanel } from "./RouteFundingPanel";
import { StepPlan } from "./StepPlan";
import { GatherDocuments } from "./GatherDocuments";
import { GatheringAdvanced, ModePreference } from "./ModePreference";
import { GatheringTargetPicker } from "./GatheringTargetPicker";
import { DestinationPicker } from "./DestinationPicker";
import { SavePlanBar, SavedPlanSummary } from "./SavedPlanSummary";
import { Segmented } from "./ui/Segmented";
import { cn } from "@/lib/utils";
import { fieldLabel } from "./ui/field";

export function DocumentRoutePanel({
	inventory,
	enabled,
	onEnabledChange,
}: {
	inventory: ReturnType<typeof useDocumentInventory>;
	enabled: boolean;
	onEnabledChange: (enabled: boolean) => void;
}) {
	const {
		result,
		route: shownRoute,
		syncing,
		calculating,
		selectedGoal,
		buyAll,
		allProfiles,
		setBuyAll,
		setAllProfiles,
		incompleteCount,
		locked,
		lockedStatus,
	} = useBattlePassPlanContext();
	const ready = typeof result !== "string";
	const state = locked
		? lockedStatus?.kind === "broken" || !ready
			? { tone: "warning", label: "Needs re-optimizing", Icon: CircleAlert }
			: { tone: "success", label: "Saved", Icon: CircleCheck }
		: ready
			? incompleteCount > 0
				? { tone: "warning", label: "Partial", Icon: CircleAlert }
				: { tone: "success", label: "Ready", Icon: CircleCheck }
			: calculating
				? { tone: "muted", label: "Calculating", Icon: LoaderCircle }
				: { tone: "warning", label: "Needs setup", Icon: CircleAlert };
	return (
		<section aria-labelledby="docs-breakdown-heading" className="space-y-4 rounded-lg bg-card p-3 sm:p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 id="docs-breakdown-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
					<Layers3 className="size-5 text-brand" aria-hidden />
					Docs breakdown
				</h2>
				<Toggle indicator className="h-9 text-sm" checked={enabled} onChange={onEnabledChange}>
					Optimizer
				</Toggle>
			</div>
			{enabled ? (
				<>
					<section
						aria-labelledby="route-config-heading"
						className={cn(
							"space-y-6 rounded-lg p-4",
							(ready && incompleteCount === 0) || calculating ? "bg-surface-raised/40" : "bg-brand/[0.07]",
						)}
					>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h3 id="route-config-heading" className="text-base font-semibold">
								{locked ? "Saved plan" : "Route configuration"}
							</h3>
							<span
								role="status"
								className={cn(
									"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
									state.tone === "success" && "bg-success/15 text-success",
									state.tone === "warning" && "bg-warning/15 text-warning",
									state.tone === "muted" && "bg-surface-raised text-muted-foreground",
								)}
							>
								<state.Icon className={cn("size-3.5", state.tone === "muted" && "animate-spin")} aria-hidden />
								{state.label}
							</span>
						</div>
						{locked ? (
							<SavedPlanSummary />
						) : (
							<>
								<h4 className="text-base font-semibold">Route</h4>
								<div className="flex flex-wrap items-start gap-x-6 gap-y-5">
									<div className={cn(fieldLabel, "w-full min-w-0 sm:w-auto")}>
										<span>Destination</span>
										<DestinationPicker />
									</div>
									{selectedGoal !== "owned" && (
										<div className={fieldLabel}>
											<span>Rewards</span>
											<Segmented
												label="Rewards"
												value={buyAll ? "all" : "required"}
												onChange={(value) => setBuyAll(value === "all")}
												options={[
													{ value: "required", label: "Required" },
													{ value: "all", label: "All through destination" },
												]}
											/>
										</div>
									)}
									<div className={fieldLabel}>
										<span>Inventory</span>
										<div className="flex flex-wrap gap-2">
											<Toggle indicator className="h-9 text-sm" checked={allProfiles} onChange={setAllProfiles}>
												All profiles
											</Toggle>
											<Toggle
												indicator
												className="h-9 text-sm"
												checked={inventory.preferences.useClassified}
												onChange={(value) => inventory.setPreference("useClassified", value)}
											>
												Use classified
											</Toggle>
										</div>
									</div>
									<FundingInputs />
								</div>
								<ModePreference />
								<GatheringTargetPicker />
								{incompleteCount > 0 && (
									<p className="text-xs text-warning">
										{incompleteCount} {incompleteCount === 1 ? "reward has" : "rewards have"} incomplete costs and{" "}
										{incompleteCount === 1 ? "is" : "are"} left out.
									</p>
								)}
								<GatheringAdvanced />
								<SavePlanBar />
							</>
						)}
					</section>
					{shownRoute ? (
						<div aria-busy={syncing || undefined} data-syncing={syncing} className="group/sync space-y-4">
							<RouteSummary />
							<GatherDocuments />
							<RouteFundingPanel />
							<StepPlan mostRewardsNow={selectedGoal === "owned"} />
						</div>
					) : (
						<RouteSkeleton
							message={typeof result === "string" ? result : CALCULATING_ROUTE}
							calculating={calculating}
						/>
					)}
				</>
			) : (
				<div className="space-y-3">
					<p role="note" className="flex items-start gap-2 rounded-lg bg-warning/10 px-4 py-3 text-sm text-foreground">
						<CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
						<span>
							<span className="font-semibold">Hey! This is a work in progress.</span> It should work as intended, but
							please double check. UI will be actively improved as we go.
						</span>
					</p>
					<p className="text-sm text-muted-foreground">
						Enable the optimizer to plan claim order, funding and profile recommendations. Pick a destination and it
						works out which rewards to claim and in what order, which profile should claim each one, and how many
						documents you still need to gather or buy, using the documents you already own.
					</p>
				</div>
			)}
		</section>
	);
}

/** Ghost of the breakdown layout, so the page keeps its shape until a route exists. */
function RouteSkeleton({ message, calculating }: { message: string; calculating: boolean }) {
	const ghost = cn("rounded-lg bg-surface-raised/25", calculating && "animate-pulse");
	return (
		<div className="relative space-y-4" aria-busy={calculating || undefined}>
			<div aria-hidden className="space-y-4">
				<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
					<div className={cn(ghost, "col-span-2 h-40 lg:row-span-2 lg:h-auto")} />
					<div className={cn(ghost, "h-20")} />
					<div className={cn(ghost, "h-20")} />
					<div className={cn(ghost, "col-span-2 h-[4.5rem]")} />
				</div>
				{[0, 1, 2].map((row) => (
					<div key={row} className={cn(ghost, "h-11")} />
				))}
			</div>
			<p
				role="status"
				className="absolute inset-x-4 top-12 mx-auto flex max-w-xl items-start gap-2 rounded-lg bg-card/95 px-4 py-3 text-sm text-muted-foreground shadow-lg"
			>
				{calculating ? (
					<LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
				) : (
					<CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
				)}
				{message}
			</p>
		</div>
	);
}
