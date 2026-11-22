import type { interpretDocumentRoute } from "./document-route-model";
import { compareCurrencyBundles, optimizeRouteFunding } from "./funding-model";
import { gatheringScenario, type GatheringFilters } from "./gathering-savings-model";

type Route = ReturnType<typeof interpretDocumentRoute>;

export interface RouteOutcome {
	/** Documents gathered. */
	gathered: number;
	cashCents: number;
	tarCoinsLeft: number;
}

export interface BetterRoute {
	/** Why the fresh route wins: less cash, fewer documents for the same cash, or more TarCoins left. */
	reason: "cash" | "documents" | "tarCoins";
	saved: RouteOutcome;
	fresh: RouteOutcome;
	/** The gathering target that gives the fresh outcome. */
	target: number;
}

export interface PricingContext {
	filters: GatheringFilters;
	days: number;
	wallet: number;
	allowSpecial: boolean;
	reserve: number;
}

/** Prices a route gathering `count` documents the way the gathering breakpoints do. */
function outcome(route: Route, count: number, context: PricingContext): RouteOutcome {
	const scenario = gatheringScenario(route, count, context.filters, context.days, context.reserve);
	const plan = optimizeRouteFunding(scenario.claims, context.wallet, context.allowSpecial);
	return {
		gathered: scenario.quantities.reduce((sum, row) => sum + row.quantity, 0),
		cashCents: compareCurrencyBundles(plan, context.allowSpecial).cashCents,
		tarCoinsLeft: plan.balanceTarCoins,
	};
}

/** The fewest documents, up to `limit`, that bring the route's cash down to `cashCents`.
 * Gathering more never raises the cash, so a binary search finds it. */
function fewestGathering(route: Route, limit: number, cashCents: number, context: PricingContext) {
	let low = 0,
		high = limit;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (outcome(route, middle, context).cashCents <= cashCents) high = middle;
		else low = middle + 1;
	}
	return { target: low, outcome: outcome(route, low, context) };
}

/** Compares a freshly solved route with the saved plan at the saved plan's
 * gathering amount. Each side gathers the fewest documents that reach its cash
 * there. The fresh route is better only when it pays less, pays the same with
 * fewer documents to gather, or pays and gathers the same but leaves more
 * TarCoins. A different claim order or owners with the same outcome is not
 * better. Returns null otherwise or when either route cannot be priced. */
export function findBetterRoute(
	saved: Route,
	fresh: Route,
	gathered: number,
	context: PricingContext,
): BetterRoute | null {
	try {
		const before = fewestGathering(saved, gathered, outcome(saved, gathered, context).cashCents, context).outcome;
		const atSame = outcome(fresh, gathered, context);
		if (atSame.cashCents > before.cashCents) return null;
		const best = fewestGathering(fresh, gathered, atSame.cashCents, context);
		if (atSame.cashCents < before.cashCents)
			return { reason: "cash", saved: before, fresh: best.outcome, target: best.target };
		if (best.outcome.gathered < before.gathered)
			return { reason: "documents", saved: before, fresh: best.outcome, target: best.target };
		if (best.outcome.gathered === before.gathered && best.outcome.tarCoinsLeft > before.tarCoinsLeft)
			return { reason: "tarCoins", saved: before, fresh: best.outcome, target: best.target };
		return null;
	} catch {
		return null;
	}
}
