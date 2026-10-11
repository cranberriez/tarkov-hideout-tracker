import { SEASONAL_CONFIG } from "../../lib/cfg/seasonal";
import {
	coverCosts,
	pages,
	planGoals,
	previewProgress,
	type PassPage,
	type Progress,
} from "../battle-pass/lib/battle-pass-model";

/** Compare UTC calendar days; the reported final date is an estimate, not a timed announcement. */
export function estimatedDaysRemaining(now: number) {
	const date = new Date(now);
	const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
	const end = new Date(SEASONAL_CONFIG.endsAt);
	const lastDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
	return Math.max(0, Math.round((lastDay - today) / 86_400_000));
}

export function seasonOverview(progress: Progress, useClassified: boolean, passPages: PassPage[] = pages) {
	const all = passPages.flatMap((page) => page.cells);
	const completed = new Set(progress.completed);
	const goalIds = new Set(progress.goals);
	const plan = planGoals(progress.goals, progress.completed, passPages, progress.avoidedDocuments);
	const coverage = coverCosts(
		plan.costs,
		progress.inventory,
		progress.classified,
		useClassified,
		progress.avoidedDocuments,
	);
	// One pool across every goal and prerequisite. Locked pages cannot use leftover stock.
	const preview = previewProgress(
		plan.selected,
		progress.completed,
		progress.inventory,
		progress.classified,
		useClassified,
		progress.avoidedDocuments,
		passPages,
	);
	return {
		completed: all.filter((tile) => completed.has(tile.id)).length,
		totalRewards: all.length,
		plan,
		coverage,
		goals: passPages.flatMap((page) =>
			page.cells
				.filter((tile) => goalIds.has(tile.id))
				.map((tile) => ({
					tile,
					page: page.num,
					completed: completed.has(tile.id),
					fraction: completed.has(tile.id) ? 1 : (preview.fractions.get(tile.id) ?? 0),
				})),
		),
	};
}
