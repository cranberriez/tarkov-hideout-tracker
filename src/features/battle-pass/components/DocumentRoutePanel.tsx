"use client";

import { useMemo, useState } from "react";
import { useBattlePassData, useBattlePassSave } from "../BattlePassSeason";
import type { RewardConfiguration } from "../lib/battle-pass-configuration";
import { rewardCostStatus } from "../lib/battle-pass-configuration";
import type { useDocumentInventory } from "../useDocumentInventory";
import { useDocumentRoute } from "../useDocumentRoute";
import { Toggle } from "./ui/Toggle";
import { DocumentIcon } from "./ui/DocumentIcon";
import { documentDisplayName } from "../lib/battle-pass-display";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { Costs } from "../lib/battle-pass-model";

export function DocumentRoutePanel({
	inventory,
	configuration,
	costs,
	scopeLabel,
}: {
	inventory: ReturnType<typeof useDocumentInventory>;
	configuration: RewardConfiguration;
	costs: Costs | null;
	scopeLabel: string;
}) {
	const { pages, tiles, documentKeys, documents, seasonId } = useBattlePassData();
	const seasonalAvailable = useUserStore((state) => !!state.seasonalProfiles[seasonId]);
	const { stored } = useBattlePassSave();
	const [destination, setDestination] = useState("finish");
	const [buyAll, setBuyAll] = useState(false);
	const [allProfiles, setAllProfiles] = useState(true);
	const selectedGoal =
		destination === "goals" && stored.goals.length
			? "goals"
			: destination !== "finish" && stored.goals.includes(destination)
				? destination
				: "finish";
	const input = useMemo(() => {
		const invalidRewardIds: string[] = [];
		const configuredPages = pages.map((page) => ({
			...page,
			cells: page.cells.map((tile) => {
				const status = rewardCostStatus(tile, configuration[tile.id], documentKeys);
				if (!status.costs) invalidRewardIds.push(tile.id);
				return {
					...tile,
					cost: status.costs ?? {},
					totalDocumentCost: Object.values(status.costs ?? {}).reduce((a, b) => a + b, 0),
				};
			}),
		}));
		return {
			pages: configuredPages,
			profiles: allProfiles
				? inventory.profiles.filter((profile) => profile.key !== seasonId || seasonalAvailable)
				: [inventory.selectedProfile],
			completedIds: stored.completed,
			goalIds: selectedGoal === "finish" ? [] : selectedGoal === "goals" ? stored.goals : [selectedGoal],
			finishSeason: selectedGoal === "finish",
			buyAll,
			classified: stored.classified,
			useClassified: inventory.preferences.useClassified,
			invalidRewardIds,
		};
	}, [
		pages,
		configuration,
		documentKeys,
		allProfiles,
		inventory.profiles,
		inventory.selectedProfile,
		stored.completed,
		selectedGoal,
		buyAll,
		inventory.preferences.useClassified,
		stored.classified,
		stored.goals,
		seasonId,
		seasonalAvailable,
	]);
	const result = useDocumentRoute(input, allProfiles || inventory.available);
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
						{stored.goals.length > 0 && <option value="goals">All saved goals</option>}
						{stored.goals.map((id) => {
							const tile = tiles.find((reward) => reward.id === id);
							return (
								<option key={id} value={id}>
									{tile?.displayName ?? `Unavailable goal (${id})`}
								</option>
							);
						})}
					</select>
				</label>
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
			{typeof result === "string" ? (
				<p role="status" className="text-sm">
					{result}
				</p>
			) : (
				result && <RouteResult result={result} documents={documents} />
			)}
		</section>
	);
}

function RouteResult({
	result,
	documents,
}: {
	result: Exclude<ReturnType<typeof useDocumentRoute>, string | null>;
	documents: ReturnType<typeof useBattlePassData>["documents"];
}) {
	return (
		<div className="space-y-3">
			<p className="text-sm" aria-live="polite">
				{result.claims.length} rewards in the route · {result.possibleNow} claimable now ·{" "}
				<strong>{result.additionalClassified} additional classified documents needed</strong>
			</p>
			{result.claims.length === 0 ? (
				<p className="text-sm text-muted-foreground">Destination already reached.</p>
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
