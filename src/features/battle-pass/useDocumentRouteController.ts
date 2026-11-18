"use client";

import { useMemo, useState } from "react";
import { useBattlePassData, useBattlePassSave } from "./BattlePassSeason";
import { rewardCostStatus, type RewardConfiguration } from "./lib/battle-pass-configuration";
import type { useDocumentInventory } from "./useDocumentInventory";
import { useDocumentRoute } from "./useDocumentRoute";
import { useUserStore } from "@/lib/stores/useUserStore";

/** One active route supplies the breakdown, funding calculator and reward recommendations. */
export function useDocumentRouteController(
	inventory: ReturnType<typeof useDocumentInventory>,
	configuration: RewardConfiguration,
	enabled = true,
) {
	const { pages, documentKeys, seasonId } = useBattlePassData();
	const seasonalAvailable = useUserStore((state) => !!state.seasonalProfiles[seasonId]);
	const { stored } = useBattlePassSave();
	const [destination, setDestination] = useState("finish");
	const [buyAll, setBuyAll] = useState(false);
	const [allProfiles, setAllProfiles] = useState(true);
	const destinationIds = [...new Set([...stored.goals, ...(pages.at(-1)?.cells.map((tile) => tile.id) ?? [])])];
	const selectedGoal =
		destination === "owned"
			? "owned"
			: destination === "goals" && stored.goals.length
				? "goals"
				: destination !== "finish" && destinationIds.includes(destination)
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
			goalIds:
				selectedGoal === "finish" || selectedGoal === "owned"
					? []
					: selectedGoal === "goals"
						? stored.goals
						: [selectedGoal],
			finishSeason: selectedGoal === "finish",
			buyAll: selectedGoal === "owned" ? false : buyAll,
			mostRewardsNow: selectedGoal === "owned",
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
	const result = useDocumentRoute(input, enabled && (allProfiles || inventory.available));
	const lastRelevantPage =
		selectedGoal === "finish" || selectedGoal === "owned"
			? pages.length - 1
			: pages.findLastIndex((page) => page.cells.some((tile) => input.goalIds.includes(tile.id)));
	const incompleteCount = pages
		.slice(0, lastRelevantPage + 1)
		.reduce(
			(count, page) =>
				count +
				page.cells.filter((tile) => !stored.completed.includes(tile.id) && input.invalidRewardIds.includes(tile.id))
					.length,
			0,
		);
	return {
		result,
		selectedGoal,
		destinationIds,
		buyAll,
		allProfiles,
		setDestination,
		setBuyAll,
		setAllProfiles,
		incompleteCount,
	};
}
