import type { gatheringScenario, SavingsRoute } from "./gathering-savings-model";

export interface PlannedDocument {
	/** Documents the plan's remaining claims on this profile cost. */
	need: number;
	/** Owned documents the plan spends. */
	used: number;
	/** Documents the plan gathers. */
	gather: number;
	/** Owned classified documents the plan spends in place of this type. */
	classified: number;
	/** Classified documents the plan buys in place of this type. */
	buy: number;
}

export interface PlanNeeds {
	byProfile: Record<string, Record<string, PlannedDocument>>;
	classified: { use: number; buy: number };
}

const emptyRow = (): PlannedDocument => ({ need: 0, used: 0, gather: 0, classified: 0, buy: 0 });

/** What the saved plan's remaining claims need of each document, per claiming profile, and how each is covered. */
export function planNeeds(route: SavingsRoute, scenario: ReturnType<typeof gatheringScenario> | null): PlanNeeds {
	const byProfile: PlanNeeds["byProfile"] = {};
	// Gathering replaces purchases first, so it can also leave owned classified documents unused.
	// Scenario claims keep the route's claim order.
	const covers = scenario?.claims ?? route.claims;
	route.claims.forEach((claim, index) => {
		const gathered = new Map(
			(scenario?.gatheredByClaim[index] ?? []).map((row) => [row.documentKey, row.quantity] as const),
		);
		// Classified documents are interchangeable within a claim: owned ones fill the
		// shortfall in cost order and purchases cover the rest.
		let classified = covers[index].classifiedUsed;
		for (const [key, amount] of Object.entries(claim.cost)) {
			const row = ((byProfile[claim.profileKey] ??= {})[key] ??= emptyRow());
			const used = claim.ordinaryUsed[key] ?? 0;
			const gather = gathered.get(key) ?? 0;
			const shortfall = Math.max(0, amount - used - gather);
			const fromClassified = Math.min(classified, shortfall);
			classified -= fromClassified;
			row.need += amount;
			row.used += used;
			row.gather += gather;
			row.classified += fromClassified;
			row.buy += shortfall - fromClassified;
		}
	});
	return {
		byProfile,
		classified: {
			use: covers.reduce((sum, claim) => sum + claim.classifiedUsed, 0),
			buy: covers.reduce((sum, claim) => sum + claim.additionalClassified, 0),
		},
	};
}

/** Combine profiles for the "All" inventory view. */
export function combinedNeeds(needs: PlanNeeds, profileKeys: string[]): Record<string, PlannedDocument> {
	const result: Record<string, PlannedDocument> = {};
	for (const profile of profileKeys)
		for (const [key, row] of Object.entries(needs.byProfile[profile] ?? {})) {
			const total = (result[key] ??= emptyRow());
			for (const field of Object.keys(total) as (keyof PlannedDocument)[]) total[field] += row[field];
		}
	return result;
}

/** Header totals for the profiles in view: planned documents and how many owned ordinary or classified cover. */
export function planTotals(needs: PlanNeeds, profileKeys: string[]) {
	const rows = Object.values(combinedNeeds(needs, profileKeys));
	const needed = rows.reduce((sum, row) => sum + row.need, 0);
	const covered = rows.reduce((sum, row) => sum + row.used + row.classified, 0);
	return { needed, covered, missing: Math.max(0, needed - covered) };
}
