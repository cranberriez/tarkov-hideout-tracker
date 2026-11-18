"use client";

import { useBattlePassData, useBattlePassSave } from "../BattlePassSeason";
import type { useDocumentInventory } from "../useDocumentInventory";
import { useDocumentRoute } from "../useDocumentRoute";
import { Toggle } from "./ui/Toggle";
import { DocumentIcon } from "./ui/DocumentIcon";
import { documentDisplayName } from "../lib/battle-pass-display";
import { Layers3, ListOrdered, SlidersHorizontal } from "lucide-react";
import { RouteSummary } from "./RouteSummary";
import type { useDocumentRouteController } from "../useDocumentRouteController";
import { RouteFundingPanel } from "./RouteFundingPanel";

export function DocumentRoutePanel({
	inventory,
	route,
}: {
	inventory: ReturnType<typeof useDocumentInventory>;
	route: ReturnType<typeof useDocumentRouteController>;
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
	return (
		<section aria-labelledby="docs-breakdown-heading" className="space-y-7 rounded-lg bg-card p-3 sm:p-5">
			<header className="space-y-4">
				<h2 id="docs-breakdown-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
					<Layers3 className="size-5 text-brand" aria-hidden />
					Docs breakdown
				</h2>
				{typeof result === "string" ? (
					<p role="status" className="text-sm text-muted-foreground">
						{result}
					</p>
				) : (
					result && <RouteSummary route={result} />
				)}
			</header>
			<section className="space-y-4 rounded-lg border border-border bg-surface-raised/40 p-4">
				<h3 className="flex items-center gap-2 text-base font-semibold">
					<SlidersHorizontal className="size-4 text-brand" aria-hidden />
					Route configuration
				</h3>
				<div className="flex flex-wrap items-end gap-3">
					<label className="grid gap-1 text-xs text-muted-foreground">
						Destination
						<select
							value={selectedGoal}
							onChange={(event) => setDestination(event.target.value)}
							className="h-9 max-w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
						>
							<option value="finish">Finish the season</option>
							<option value="owned">Most rewards with owned documents</option>
							{stored.goals.length > 0 && <option value="goals">All saved goals</option>}
							{destinationIds.map((id) => {
								const tile = tiles.find((reward) => reward.id === id);
								const page = pages.find((page) => page.cells.some((reward) => reward.id === id));
								return (
									<option key={id} value={id}>
										{tile ? `${tile.displayName} · Page ${page?.num}` : `Unavailable goal (${id})`}
									</option>
								);
							})}
						</select>
					</label>
					{selectedGoal !== "owned" && (
						<label className="grid gap-1 text-xs text-muted-foreground">
							Rewards
							<select
								value={buyAll ? "all" : "required"}
								onChange={(event) => setBuyAll(event.target.value === "all")}
								className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
							>
								<option value="required">Required rewards</option>
								<option value="all">All rewards through destination</option>
							</select>
						</label>
					)}
					<Toggle checked={allProfiles} onChange={setAllProfiles}>
						Include all profiles
					</Toggle>
					<Toggle
						checked={inventory.preferences.useClassified}
						onChange={(value) => inventory.setPreference("useClassified", value)}
					>
						Use classified
					</Toggle>
				</div>
				{selectedGoal === "finish" && !buyAll && (
					<p className="text-xs text-muted-foreground">Includes the final page and its prerequisites.</p>
				)}
				{incompleteCount > 0 && (
					<p className="text-xs text-warning">
						{incompleteCount} {incompleteCount === 1 ? "reward has" : "rewards have"} incomplete costs{" "}
						{selectedGoal === "owned" ? "in this season" : "through this destination"}. Only configured rewards are
						included.
					</p>
				)}
			</section>
			{result && typeof result !== "string" && (
				<RouteResult result={result} documents={documents} mostRewardsNow={selectedGoal === "owned"} />
			)}
			<RouteFundingPanel route={typeof result === "string" ? null : result} />
		</section>
	);
}

function RouteResult({
	result,
	documents,
	mostRewardsNow,
}: {
	result: Exclude<ReturnType<typeof useDocumentRoute>, string | null>;
	documents: ReturnType<typeof useBattlePassData>["documents"];
	mostRewardsNow: boolean;
}) {
	return (
		<div className="space-y-3">
			<h3 className="flex items-center gap-2 text-base font-semibold">
				<ListOrdered className="size-4 text-brand" aria-hidden />
				Claim order <span className="text-xs font-normal text-muted-foreground">{result.claims.length} rewards</span>
			</h3>
			{result.claims.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{mostRewardsNow
						? "No further rewards are affordable with the selected inventories."
						: "Destination already reached."}
				</p>
			) : (
				<div className="max-h-96 overflow-auto rounded-md border border-border">
					<table className="w-full text-left text-sm">
						<thead className="sticky top-0 bg-card text-xs text-muted-foreground">
							<tr>
								<th className="p-3">Reward</th>
								<th className="p-3">Profile</th>
								<th className="p-3">
									Documents <span className="whitespace-nowrap font-normal">(owned / needed)</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{result.claims.map((claim, index) => (
								<tr key={claim.rewardId} className="border-t border-border">
									<td className="p-3">
										<span className="mr-2 text-muted-foreground">{index + 1}.</span>
										{result.selected.find((tile) => tile.id === claim.rewardId)?.displayName}
										<span className="block text-xs text-muted-foreground">
											Page {claim.page} ·{" "}
											{claim.possibleNow
												? "Ready"
												: claim.additionalClassified > 0
													? "Missing documents"
													: "Page locked"}
										</span>
									</td>
									<td className="p-3">{claim.profileLabel}</td>
									<td className="p-3">
										<ul className="flex flex-wrap gap-x-4 gap-y-2">
											{Object.entries(claim.cost).map(([key, amount]) => (
												<li
													key={key}
													className="inline-flex items-center gap-0.5 whitespace-nowrap"
													aria-label={`${documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key)}: ${claim.ordinaryUsed[key] ?? 0} of ${amount}`}
													title={documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key)}
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
		</div>
	);
}
