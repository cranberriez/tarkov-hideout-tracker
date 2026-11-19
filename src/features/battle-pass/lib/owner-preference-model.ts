import { replayClaims, type DocumentRouteRequest, type interpretDocumentRoute } from "./document-route-model";

type Route = ReturnType<typeof interpretDocumentRoute>;

/** Needs no classified document earlier than before and keeps every "ready
 * now" claim, so every funding plan for `before` still works. */
function noWorse(before: Route, after: Route) {
	if (after.possibleNow < before.possibleNow) return false;
	let previous = 0,
		next = 0;
	return before.claims.every((claim, index) => {
		previous += claim.additionalClassified;
		next += after.claims[index].additionalClassified;
		return next <= previous;
	});
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
