import { replayClaims, type DocumentRouteRequest, type interpretDocumentRoute } from "./document-route-model";
import { gatheringDailyCap } from "./gathering-caps";
import { gatheringScenario, type GatheringFilters } from "./gathering-savings-model";

type Route = ReturnType<typeof interpretDocumentRoute>;

/** Preferred-mode setting that spreads gathering across modes instead of preferring one. */
export const BALANCED_MODE = "balanced";

/** No claim needs more classified documents, counted up to it, than before. */
function noEarlierClassified(before: { additionalClassified: number }[], after: { additionalClassified: number }[]) {
	let previous = 0,
		next = 0;
	return before.every((claim, index) => {
		previous += claim.additionalClassified;
		next += after[index].additionalClassified;
		return next <= previous;
	});
}

/** Needs no classified document earlier than before and keeps every "ready
 * now" claim, so every funding plan for `before` still works. */
function noWorse(before: Route, after: Route) {
	return after.possibleNow >= before.possibleNow && noEarlierClassified(before.claims, after.claims);
}

/** Moves claims to better-ranked profiles (lower `rank`) whenever that costs
 * nothing, keeping the rewards and claim order. Claims that need gathering then
 * land in the modes the player prefers. */
export function preferOwners(request: DocumentRouteRequest, route: Route, rank: (profileKey: string) => number) {
	const profiles = request.input.profiles;
	if (profiles.length < 2) return route;
	let current = route;
	route.claims.forEach((claim, index) => {
		const better = profiles
			.filter((profile) => rank(profile.key) < rank(current.claims[index].profileKey))
			.sort((a, b) => rank(a.key) - rank(b.key));
		for (const profile of better) {
			const owners = current.claims.map((c, k) =>
				k === index ? { ...c, profileKey: profile.key, profileLabel: profile.label } : c,
			);
			const next = replayClaims(request, owners);
			if (noWorse(current, next)) {
				current = next;
				break;
			}
		}
	});
	return current;
}

/** Each mode's exact gathering days at `target`, slowest first. */
function gatheringLoad(route: Route, target: number, filters: GatheringFilters, reserve: number) {
	const scenario = gatheringScenario(route, target, filters);
	const byMode = new Map<string, number>();
	for (const row of scenario.quantities) byMode.set(row.profileKey, (byMode.get(row.profileKey) ?? 0) + row.quantity);
	const load = [...byMode].map(([key, quantity]) => quantity / gatheringDailyCap(key, reserve)).sort((a, b) => b - a);
	return { scenario, load };
}

/** Negative when load `a` finishes sooner than `b`: the slowest mode's whole
 * days first, then each mode's exact days, slowest first. */
function compareLoad(a: number[], b: number[]) {
	const days = Math.ceil(a[0] ?? 0) - Math.ceil(b[0] ?? 0);
	if (days) return days;
	for (let index = 0; index < Math.max(a.length, b.length); index++) {
		const difference = (a[index] ?? 0) - (b[index] ?? 0);
		if (difference) return difference;
	}
	return 0;
}

/** Moves claims between profiles to shorten the parallel gathering days at
 * `target` (the slowest mode first, then the next), keeping the rewards and
 * claim order. A move is kept only when it costs nothing: the same rules as
 * `preferOwners`, and after gathering `target` no claim needs classified
 * earlier, so the checkout cannot rise. Local search: each kept move strictly
 * shortens the load, so it ends. The route comes back unchanged unless the
 * slowest mode saves at least one whole day. */
export function balanceOwners(
	request: DocumentRouteRequest,
	route: Route,
	target: number,
	filters: GatheringFilters,
	reserve = 0,
) {
	const profiles = request.input.profiles;
	if (profiles.length < 2 || target <= 0) return route;
	let current = route;
	let { scenario, load } = gatheringLoad(current, target, filters, reserve);
	const startDays = Math.ceil(load[0] ?? 0);
	for (let improved = true; improved;) {
		improved = false;
		for (let index = 0; index < current.claims.length; index++) {
			for (const profile of profiles) {
				if (profile.key === current.claims[index].profileKey) continue;
				const next = replayClaims(
					request,
					current.claims.map((claim, k) =>
						k === index ? { ...claim, profileKey: profile.key, profileLabel: profile.label } : claim,
					),
				);
				if (!noWorse(current, next)) continue;
				const candidate = gatheringLoad(next, target, filters, reserve);
				if (!noEarlierClassified(scenario.claims, candidate.scenario.claims)) continue;
				if (compareLoad(candidate.load, load) >= 0) continue;
				current = next;
				({ scenario, load } = candidate);
				improved = true;
			}
		}
	}
	// Exact-day moves only guide the search; keep them only when the slowest mode finishes a day sooner.
	return Math.ceil(load[0] ?? 0) < startDays ? current : route;
}
