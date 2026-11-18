import type { interpretDocumentRoute } from "./document-route-model";
import { optimizeRouteFunding, rewardTarCoins } from "./funding-model";
import { gatheringDailyCap } from "./gathering-caps";

export type SavingsRoute = ReturnType<typeof interpretDocumentRoute>;
export interface GatheringQuantity {
	profileKey: string;
	profileLabel: string;
	documentKey: string;
	quantity: number;
}
export interface GatheringBreakpoint {
	gathered: number;
	quantities: GatheringQuantity[];
	windows: { profileKey: string; profileLabel: string; quantity: number; cap: number; windows: number }[];
	parallelWindows: number;
	cashCents: number;
	savingsCents: number;
	remainingClassified: number;
}

/** Fixed selected rewards, owners and claim order. Gather matching shortages in
 * claim order; replay shared owned classified after ordinary stock every time.
 * This is a concrete gathering path, not an optimization over all gathering paths. */
export function gatheringScenario(route: SavingsRoute, gathered: number) {
	let remaining = gathered;
	let classified = route.claims.reduce((sum, claim) => sum + claim.classifiedUsed, 0);
	const quantities: GatheringQuantity[] = [];
	const coins = new Map(route.selected.map((tile) => [tile.id, rewardTarCoins(tile)]));
	const claims = route.claims.map((claim) => {
		let shortfall = 0;
		for (const [documentKey, cost] of Object.entries(claim.cost)) {
			const missing = Math.max(0, cost - (claim.ordinaryUsed[documentKey] ?? 0));
			const quantity = Math.min(remaining, missing);
			remaining -= quantity;
			shortfall += missing - quantity;
			if (quantity) {
				const existing = quantities.find(
					(row) => row.profileKey === claim.profileKey && row.documentKey === documentKey,
				);
				if (existing) existing.quantity += quantity;
				else quantities.push({ profileKey: claim.profileKey, profileLabel: claim.profileLabel, documentKey, quantity });
			}
		}
		const used = Math.min(classified, shortfall);
		classified -= used;
		return {
			rewardId: claim.rewardId,
			page: claim.page,
			additionalClassified: shortfall - used,
			tarCoins: coins.get(claim.rewardId) ?? 0,
		};
	});
	return { claims, quantities };
}

/** Binary-search each next cash drop on the monotone gathering path. Avoids one
 * funding solve per document, and runs only on demand in a dedicated worker. */
export function buildGatheringSavings(
	route: SavingsRoute,
	startingTarCoins: number,
	allowSpecial: boolean,
): GatheringBreakpoint[] {
	const maximum = route.additionalClassified - 1;
	if (maximum < 1) return [];
	const cache = new Map<number, number>();
	const cash = (count: number) => {
		if (!cache.has(count))
			cache.set(
				count,
				optimizeRouteFunding(gatheringScenario(route, count).claims, startingTarCoins, allowSpecial).cashCents,
			);
		return cache.get(count)!;
	};
	const baseline = cash(0);
	const minimum = cash(maximum);
	const result: GatheringBreakpoint[] = [];
	let count = 0;
	let previous = baseline;
	while (previous > minimum) {
		let low = count + 1,
			high = maximum;
		while (low < high) {
			const middle = Math.floor((low + high) / 2);
			if (cash(middle) < previous) high = middle;
			else low = middle + 1;
		}
		count = low;
		previous = cash(count);
		const { claims, quantities } = gatheringScenario(route, count);
		const windows: GatheringBreakpoint["windows"] = [];
		for (const row of quantities) {
			let profile = windows.find((item) => item.profileKey === row.profileKey);
			if (!profile) {
				profile = {
					profileKey: row.profileKey,
					profileLabel: row.profileLabel,
					quantity: 0,
					cap: gatheringDailyCap(row.profileKey),
					windows: 0,
				};
				windows.push(profile);
			}
			profile.quantity += row.quantity;
			profile.windows = Math.ceil(profile.quantity / profile.cap);
		}
		result.push({
			gathered: count,
			quantities,
			windows,
			parallelWindows: Math.max(...windows.map((row) => row.windows)),
			cashCents: previous,
			savingsCents: baseline - previous,
			remainingClassified: claims.reduce((sum, claim) => sum + claim.additionalClassified, 0),
		});
	}
	return result;
}
