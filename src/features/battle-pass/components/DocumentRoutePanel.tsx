"use client";

import { useBattlePassData, useBattlePassSave } from "../BattlePassSeason";
import type { useDocumentInventory } from "../useDocumentInventory";
import { CALCULATING_ROUTE, useDocumentRoute } from "../useDocumentRoute";
import { useState } from "react";
import { Toggle } from "./ui/Toggle";
import { DocumentIcon } from "./ui/DocumentIcon";
import { documentDisplayName } from "../lib/battle-pass-display";
import { CircleAlert, CircleCheck, Layers3, ListOrdered, LoaderCircle } from "lucide-react";
import { RouteSummary } from "./RouteSummary";
import type { useDocumentRouteController } from "../useDocumentRouteController";
import { FundingInputs, RouteFundingPanel } from "./RouteFundingPanel";
import { RouteOptions } from "./RouteOptions";
import { Disclosure } from "./ui/Disclosure";
import { Segmented } from "./ui/Segmented";
import { cn } from "@/lib/utils";
import { fieldLabel, flatField, syncValue } from "./ui/field";

type Route = Exclude<ReturnType<typeof useDocumentRoute>, string | null>;

export function DocumentRoutePanel({
	inventory,
	route,
	enabled,
	onEnabledChange,
}: {
	inventory: ReturnType<typeof useDocumentInventory>;
	route: ReturnType<typeof useDocumentRouteController>;
	enabled: boolean;
	onEnabledChange: (enabled: boolean) => void;
}) {
	const { pages, tiles, documents } = useBattlePassData();
	const { stored } = useBattlePassSave();
	const {
		result,
		selectedGoal,
		destinationIds,
		buyAll,
		allProfiles,
		setDestination,
		setBuyAll,
		setAllProfiles,
		incompleteCount,
	} = route;
	const ready = !!result && typeof result !== "string";
	const calculating = !result || result === CALCULATING_ROUTE;
	// Keep the last route on screen during recalculation so the page does not collapse and jump.
	const [lastRoute, setLastRoute] = useState<Route | null>(null);
	if (ready && result !== lastRoute) setLastRoute(result);
	const shownRoute = ready ? result : calculating ? lastRoute : null;
	const syncing = !ready && !!shownRoute;
	const state = ready
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
							"space-y-4 rounded-lg p-4",
							ready && incompleteCount === 0 ? "bg-surface-raised/40" : "bg-brand/[0.07]",
						)}
					>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h3 id="route-config-heading" className="text-base font-semibold">
								Route configuration
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
						<div className="flex flex-wrap items-end gap-x-6 gap-y-4">
							<label className={cn(fieldLabel, "w-full min-w-0 sm:w-auto")}>
								Destination
								<select
									value={selectedGoal}
									onChange={(event) => setDestination(event.target.value)}
									className={cn(flatField, "w-full min-w-0 sm:max-w-sm")}
								>
									<option value="finish">Finish the season</option>
									<option value="owned">Most rewards with owned documents</option>
									{stored.goals.length > 0 && <option value="goals">All saved goals</option>}
									{destinationIds.map((id) => {
										const tile = tiles.find((reward) => reward.id === id);
										const page = pages.find((page) => page.cells.some((reward) => reward.id === id));
										return (
											<option key={id} value={id}>
												{tile ? `${tile.displayName} (Page ${page?.num})` : `Unavailable goal (${id})`}
											</option>
										);
									})}
								</select>
							</label>
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
						{(selectedGoal === "finish" && !buyAll) || incompleteCount > 0 ? (
							<div className="space-y-1 text-xs">
								{selectedGoal === "finish" && !buyAll && (
									<p className="text-muted-foreground">Includes the final page and its prerequisites.</p>
								)}
								{incompleteCount > 0 && (
									<p className="text-warning">
										{incompleteCount} {incompleteCount === 1 ? "reward has" : "rewards have"} incomplete costs{" "}
										{selectedGoal === "owned" ? "in this season" : "through this destination"}. Only configured rewards
										are included.
									</p>
								)}
							</div>
						) : null}
					</section>
					{shownRoute ? (
						<div aria-busy={syncing || undefined} data-syncing={syncing} className="group/sync space-y-4">
							<RouteSummary route={shownRoute} />
							<RouteResult result={shownRoute} documents={documents} mostRewardsNow={selectedGoal === "owned"} />
							<RouteOptions route={route} />
							<RouteFundingPanel route={shownRoute} />
						</div>
					) : (
						<RouteSkeleton
							message={typeof result === "string" ? result : CALCULATING_ROUTE}
							calculating={calculating}
						/>
					)}
				</>
			) : (
				<p className="text-sm text-muted-foreground">
					Enable the optimizer to plan claim order, funding and profile recommendations.
				</p>
			)}
		</section>
	);
}

function RouteResult({
	result,
	documents,
	mostRewardsNow,
}: {
	result: Route;
	documents: ReturnType<typeof useBattlePassData>["documents"];
	mostRewardsNow: boolean;
}) {
	const name = (key: string) => documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key);
	return (
		<Disclosure
			title="Claim order"
			icon={<ListOrdered className="size-4 text-brand" aria-hidden />}
			meta={
				<>
					{result.claims.length} {result.claims.length === 1 ? "reward" : "rewards"}
					{result.claims.length > 0 && <>, {result.possibleNow} ready now</>}
				</>
			}
		>
			{result.claims.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{mostRewardsNow
						? "No further rewards are affordable with the selected inventories."
						: "Destination already reached."}
				</p>
			) : (
				<div className={cn("max-h-[60vh] overflow-auto rounded-md", syncValue)}>
					<table className="w-full text-left text-sm">
						<thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
							<tr>
								<th className="px-3 py-2 font-medium">Reward</th>
								<th className="px-3 py-2 font-medium">Profile</th>
								<th className="px-3 py-2 font-medium">
									Documents <span className="whitespace-nowrap font-normal">(owned / needed)</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{result.claims.map((claim, index) => (
								<tr key={claim.rewardId} className="odd:bg-surface-raised/25">
									<td className="px-3 py-2.5 align-top">
										<span className="flex gap-2">
											<span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">{index + 1}</span>
											<span>
												{result.selected.find((tile) => tile.id === claim.rewardId)?.displayName}
												<span className="flex gap-3 text-xs text-muted-foreground">
													<span>Page {claim.page}</span>
													{claim.possibleNow ? (
														<span className="text-success">Ready</span>
													) : (
														<span>{claim.additionalClassified > 0 ? "Missing documents" : "Page locked"}</span>
													)}
												</span>
											</span>
										</span>
									</td>
									<td className="px-3 py-2.5 align-top font-medium">{claim.profileLabel}</td>
									<td className="px-3 py-2.5 align-top">
										<ul className="flex flex-wrap gap-x-4 gap-y-2">
											{Object.entries(claim.cost).map(([key, amount]) => (
												<li
													key={key}
													className="inline-flex items-center gap-0.5 whitespace-nowrap"
													aria-label={`${name(key)}: ${claim.ordinaryUsed[key] ?? 0} of ${amount}`}
													title={name(key)}
												>
													<DocumentIcon documentKey={key} className="size-6" />
													<span className="tabular-nums">
														<span className="font-semibold">{claim.ordinaryUsed[key] ?? 0}</span>
														<span className="text-muted-foreground">/{amount}</span>
													</span>
												</li>
											))}
										</ul>
										{claim.classifiedUsed > 0 && (
											<span className="text-xs text-classified">{claim.classifiedUsed} covered by classified</span>
										)}
										{claim.additionalClassified > 0 && (
											<span className="block text-xs text-warning">
												{claim.additionalClassified} additional classified needed
											</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Disclosure>
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
