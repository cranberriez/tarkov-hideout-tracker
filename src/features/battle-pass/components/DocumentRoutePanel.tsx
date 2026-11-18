"use client";

import { useBattlePassData, useBattlePassSave } from "../BattlePassSeason";
import type { useDocumentInventory } from "../useDocumentInventory";
import { useDocumentRoute } from "../useDocumentRoute";
import { Toggle } from "./ui/Toggle";
import { DocumentIcon } from "./ui/DocumentIcon";
import { documentDisplayName } from "../lib/battle-pass-display";
import type { Costs } from "../lib/battle-pass-model";
import type { useDocumentRouteController } from "../useDocumentRouteController";
import { RouteFundingPanel } from "./RouteFundingPanel";

export function DocumentRoutePanel({
	inventory,
	route,
	costs,
	scopeLabel,
}: {
	inventory: ReturnType<typeof useDocumentInventory>;
	route: ReturnType<typeof useDocumentRouteController>;
	costs: Costs | null;
	scopeLabel: string;
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
		<section aria-labelledby="docs-breakdown-heading" className="space-y-4 rounded-lg bg-card p-4">
			<h2 id="docs-breakdown-heading" className="text-sm font-semibold">
				Docs Breakdown
			</h2>
			{costs && (
				<div className="space-y-2">
					<p className="text-xs text-muted-foreground">{scopeLabel} · document costs</p>
					<ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
						{Object.entries(costs).map(([key, amount]) => (
							<li key={key} className="flex items-center gap-2">
								<DocumentIcon documentKey={key} className="size-7 shrink-0" />
								<strong className="tabular-nums">{amount}</strong>{" "}
								{documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key)}
							</li>
						))}
					</ul>
				</div>
			)}
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
			<p className="text-xs text-muted-foreground">
				{allProfiles
					? "Uses each profile’s inventory separately."
					: `Uses ${inventory.selectedProfile.label} inventory.`}{" "}
				Already claimed rewards count toward page unlocks. Classified documents cover remaining costs after ordinary
				documents.
			</p>
			{selectedGoal === "owned" && (
				<p className="text-xs text-muted-foreground">
					Stops at the maximum rewards reachable with the included profiles’ ordinary documents and, when enabled, owned
					classified documents. No purchase is necessary.
				</p>
			)}
			{selectedGoal === "finish" && !buyAll && (
				<p className="text-xs text-muted-foreground">
					Finish the season with Required rewards claims all {pages.at(-1)?.cells.length ?? 0} final-page rewards and
					the minimum rewards needed to unlock preceding pages. Choose All rewards through destination to claim every
					reward.
				</p>
			)}
			{typeof result === "string" ? (
				<p role="status" className="text-sm">
					{result}
				</p>
			) : (
				result && <RouteResult result={result} documents={documents} mostRewardsNow={selectedGoal === "owned"} />
			)}
			{incompleteCount > 0 && (
				<p className="text-xs text-warning">
					{incompleteCount} {incompleteCount === 1 ? "reward has" : "rewards have"} incomplete costs{" "}
					{selectedGoal === "owned" ? "in this season" : "through this destination"}. The route considers only
					configured rewards.
				</p>
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
			<p className="text-sm" aria-live="polite">
				{result.claims.length} rewards in the route · {result.possibleNow} claimable now ·{" "}
				<strong>{result.additionalClassified} additional classified documents needed</strong>
			</p>
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
								<th className="p-3">Order / reward</th>
								<th className="p-3">Profile</th>
								<th className="p-3">Documents</th>
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
												? "Available with owned documents"
												: claim.additionalClassified > 0
													? "Needs additional documents"
													: "Unlock preceding pages first"}
										</span>
									</td>
									<td className="p-3">{claim.profileLabel}</td>
									<td className="p-3">
										<ul className="flex flex-wrap gap-2">
											{Object.entries(claim.cost).map(([key, amount]) => (
												<li
													key={key}
													className="flex items-center gap-1"
													title={documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key)}
												>
													<DocumentIcon documentKey={key} className="size-6" />
													<span className="tabular-nums">{amount}</span>
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
