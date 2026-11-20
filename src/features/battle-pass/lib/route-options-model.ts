import type { Tile } from "./battle-pass-model";
import type { DocumentRouteRequest, interpretDocumentRoute } from "./document-route-model";
import { optimizeRouteFunding, rewardTarCoins, type FundingClaim } from "./funding-model";
import { gatheringScenario, type GatheringFilters } from "./gathering-savings-model";

type Route = ReturnType<typeof interpretDocumentRoute>;

/** Alternative routes may buy at most this many more classified documents than the active route. */
export const ROUTE_OPTION_EXTRA_DOCUMENTS = 20;
/** Upper bound on solver calls; each call raises the required reward TarCoins. */
export const ROUTE_OPTION_MAX_LEVELS = 12;

export function fundingClaims(route: Route): FundingClaim[] {
	return route.claims.map((claim) => ({
		rewardId: claim.rewardId,
		page: claim.page,
		additionalClassified: claim.additionalClassified,
		tarCoins: rewardTarCoins(route.selected.find((tile) => tile.id === claim.rewardId)!),
	}));
}

export function routeRewardTarCoins(route: Route) {
	return route.selected.reduce((sum, tile) => sum + rewardTarCoins(tile), 0);
}

/** The route model plus two bounds: at least `minCoins` reward TarCoins and at
 * most `maxMissing` purchased classified documents. Its objective still picks
 * the fewest documents, so successive levels trace every route that could pay
 * off: a route with more documents and no more coins never costs less. Among
 * otherwise equal routes it keeps `keepIds`, so alternatives differ from the
 * active route only where the trade requires it. */
export function coinLevelModel(
	request: DocumentRouteRequest,
	minCoins: number,
	maxMissing: number,
	keepIds: string[] = [],
) {
	if (!request.model) return null;
	const amounts = request.rewards.map(({ tile }) => rewardTarCoins(tile));
	const coins = amounts.flatMap((amount, i) => (amount > 0 ? [`${amount} s_${i}`] : []));
	if (!coins.length) return null;
	const bounds = [
		`${coins.join(" + ")} >= ${minCoins}`,
		`${request.rewards.map((_, i) => `m_${i}`).join(" + ")} <= ${maxMissing}`,
	];
	// Stays below the route model's smallest TarCoin tie-break step (1 / coin
	// bound) even when every kept reward contributes.
	const keep = new Set(keepIds);
	const coinBound = amounts.reduce((sum, amount) => sum + amount, 0) + 1;
	const epsilon = (1 / (coinBound * (request.rewards.length + 1))).toFixed(12);
	const preference = request.rewards.flatMap(({ tile }, i) => (keep.has(tile.id) ? [` - ${epsilon} s_${i}`] : []));
	return request.model
		.replace("\nSubject To\n", `${preference.join("")}\nSubject To\n`)
		.replace("\nBinary\n", `\n${bounds.join("\n")}\nBinary\n`);
}

export interface RouteSwap {
	page: number;
	claim: Tile[];
	skip: Tile[];
}

/** Rewards claimed instead of the active route's, grouped by page. */
export function routeSwaps(base: Route, route: Route): RouteSwap[] {
	const baseIds = new Set(base.selected.map((tile) => tile.id));
	const routeIds = new Set(route.selected.map((tile) => tile.id));
	const pageOf = (routeOf: Route, id: string) => routeOf.claims.find((claim) => claim.rewardId === id)!.page;
	const swaps = new Map<number, RouteSwap>();
	const entry = (page: number) => swaps.get(page) ?? swaps.set(page, { page, claim: [], skip: [] }).get(page)!;
	for (const tile of route.selected) if (!baseIds.has(tile.id)) entry(pageOf(route, tile.id)).claim.push(tile);
	for (const tile of base.selected) if (!routeIds.has(tile.id)) entry(pageOf(base, tile.id)).skip.push(tile);
	return [...swaps.values()].sort((a, b) => a.page - b.page);
}

export interface RouteOption {
	/** 0 is the fewest-documents route; i is alternatives[i - 1]. */
	routeIndex: number;
	route: Route;
	/** Against the fewest-documents route. */
	swaps: RouteSwap[];
	/** Documents gathered for this route at the target. */
	gathered: number;
	/** The recommended purchase, the same plan Route funding shows for this route. */
	cashCents: number;
	tarCoinsBought: number;
	tarCoinsLeft: number;
	packs: { tarCoins: number; count: number; special: boolean }[];
	/** Against the suggested route. */
	cashDeltaCents: number;
	tarCoinsLeftDelta: number;
}

/** Prices every route gathering `target` documents, exactly as Route funding
 * does. The suggested route is the cheapest checkout; ties gather fewer
 * documents, then leave more TarCoins, then keep the earlier route. Routes that
 * cannot be priced are skipped. */
export function priceRoutes(
	routes: Route[],
	target: number,
	filters: GatheringFilters,
	days: number,
	wallet: number,
	allowSpecial: boolean,
	reserve = 0,
): { options: RouteOption[]; suggestedIndex: number } {
	const priced = routes.flatMap((route, routeIndex) => {
		try {
			const scenario = gatheringScenario(route, target, filters, days, reserve);
			const plan = optimizeRouteFunding(scenario.claims, wallet, allowSpecial);
			return [
				{
					routeIndex,
					route,
					swaps: routeSwaps(routes[0], route),
					gathered: scenario.quantities.reduce((sum, row) => sum + row.quantity, 0),
					cashCents: plan.cashCents,
					tarCoinsBought: plan.totalTarCoins,
					tarCoinsLeft: plan.balanceTarCoins,
					packs: plan.cashReceipt.map(({ tarCoins, count, special }) => ({ tarCoins, count, special })),
				},
			];
		} catch {
			return [];
		}
	});
	priced.sort(
		(a, b) =>
			a.cashCents - b.cashCents ||
			a.gathered - b.gathered ||
			b.tarCoinsLeft - a.tarCoinsLeft ||
			a.routeIndex - b.routeIndex,
	);
	const suggested = priced[0];
	if (!suggested) return { options: [], suggestedIndex: -1 };
	return {
		options: priced.map((option) => ({
			...option,
			cashDeltaCents: option.cashCents - suggested.cashCents,
			tarCoinsLeftDelta: option.tarCoinsLeft - suggested.tarCoinsLeft,
		})),
		suggestedIndex: suggested.routeIndex,
	};
}
