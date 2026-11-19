import type { Tile } from "./battle-pass-model";
import type { DocumentRouteRequest, interpretDocumentRoute } from "./document-route-model";
import {
	CASH_TOLERANCE_CENTS,
	DOCUMENT_PACKS,
	fundingOptions,
	rewardTarCoins,
	singlePackOption,
	type FundingClaim,
	type FundingOption,
} from "./funding-model";

type Route = ReturnType<typeof interpretDocumentRoute>;

/** Alternative routes may buy at most this many more classified documents than the active route. */
export const ROUTE_OPTION_EXTRA_DOCUMENTS = 20;
/** Purchases are compared up to this much above each route's minimum checkout. */
export const ROUTE_OPTION_CASH_WINDOW_CENTS = 1000;
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
	routeIndex: number;
	route: Route;
	swaps: RouteSwap[];
	purchase: FundingOption;
	/** The nearest single larger pack, shown after "Show more options". */
	singlePack: boolean;
	/** Classified documents to buy for this route. */
	classifiedToBuy: number;
	cashDeltaCents: number;
	tarCoinsLeftDelta: number;
	classifiedDelta: number;
}

/** Packs combine into many near-identical totals, so purchases are grouped into
 * price tiers no wider than the funding tolerance. Each tier keeps the purchase
 * leaving the most TarCoins; the first tier also keeps the exact minimum. */
export function purchaseTiers(options: FundingOption[]) {
	const tiers: FundingOption[][] = [];
	for (const option of options) {
		const tier = tiers.at(-1);
		if (tier && option.cashCents <= tier[0].cashCents + CASH_TOLERANCE_CENTS) tier.push(option);
		else tiers.push([option]);
	}
	return tiers.flatMap((tier, index) => {
		const best = tier.reduce((a, b) => (b.balanceTarCoins > a.balanceTarCoins ? b : a));
		return index === 0 && best !== tier[0] ? [tier[0], best] : [best];
	});
}

/** Price each route's purchase options and keep those no other option beats on
 * checkout, classified documents to buy and TarCoins left after the pass.
 * Deltas compare against the cheapest purchase on the first (active) route. */
export function buildRouteOptions(
	routes: Route[],
	startingTarCoins: number,
	allowSpecial: boolean,
	expanded: (routeIndex: number) => boolean = () => false,
): { options: RouteOption[]; singlePacks: (FundingOption | null)[] } {
	if (!routes.length) return { options: [], singlePacks: [] };
	// "Show more options" adds one purchase per route: the nearest single larger
	// pack beyond the compared range. It is offered only when that purchase would
	// survive against every other purchase, including other routes' single packs.
	const row = (routeIndex: number, purchase: FundingOption, singlePack: boolean) => ({
		routeIndex,
		route: routes[routeIndex],
		purchase,
		singlePack,
		classifiedToBuy: routes[routeIndex].additionalClassified,
	});
	type Row = ReturnType<typeof row>;
	const tierRows: Row[] = [];
	const singleRows: (Row | null)[] = [];
	routes.forEach((route, routeIndex) => {
		const claims = fundingClaims(route);
		const tiers = purchaseTiers(fundingOptions(claims, startingTarCoins, allowSpecial, ROUTE_OPTION_CASH_WINDOW_CENTS));
		tierRows.push(...tiers.map((purchase) => row(routeIndex, purchase, false)));
		const single = singlePackOption(claims, startingTarCoins, allowSpecial, tiers.at(-1)!.cashCents);
		singleRows.push(single && row(routeIndex, single, true));
	});
	const dominated = (option: Row, pool: Row[]) =>
		pool.some(
			(other) =>
				other !== option &&
				other.purchase.cashCents <= option.purchase.cashCents &&
				other.classifiedToBuy <= option.classifiedToBuy &&
				other.purchase.balanceTarCoins >= option.purchase.balanceTarCoins &&
				(other.purchase.cashCents < option.purchase.cashCents ||
					other.classifiedToBuy < option.classifiedToBuy ||
					other.purchase.balanceTarCoins > option.purchase.balanceTarCoins),
		);
	const everything = [...tierRows, ...singleRows.filter((option): option is Row => option !== null)];
	const available = singleRows.map((option) => (option && !dominated(option, everything) ? option : null));
	const singlePacks = available.map((option) => option?.purchase ?? null);
	const priced = [
		...tierRows,
		...available.filter((option): option is Row => option !== null && expanded(option.routeIndex)),
	];
	const kept = priced.filter((option) => !dominated(option, priced));
	const baseline = priced[0];
	const options = kept
		.sort(
			(a, b) =>
				a.purchase.cashCents - b.purchase.cashCents ||
				b.purchase.balanceTarCoins - a.purchase.balanceTarCoins ||
				a.classifiedToBuy - b.classifiedToBuy,
		)
		.map((option) => ({
			...option,
			swaps: routeSwaps(routes[0], option.route),
			cashDeltaCents: option.purchase.cashCents - baseline.purchase.cashCents,
			tarCoinsLeftDelta: option.purchase.balanceTarCoins - baseline.purchase.balanceTarCoins,
			classifiedDelta: option.classifiedToBuy - baseline.classifiedToBuy,
		}));
	return { options, singlePacks };
}

/** Classified packs a purchase buys, in total and before each claim. */
export function documentPlan(purchase: FundingOption) {
	const counts = DOCUMENT_PACKS.map(() => 0);
	const schedule = purchase.steps.flatMap((step, claimIndex) =>
		step.documentPacks.length ? [{ claimIndex, rewardId: step.rewardId, packs: step.documentPacks }] : [],
	);
	for (const step of schedule)
		for (const pack of step.packs)
			counts[DOCUMENT_PACKS.findIndex((p) => p.documents === pack.documents)] += pack.count;
	const packs = DOCUMENT_PACKS.flatMap((pack, k) => (counts[k] ? [{ ...pack, count: counts[k] }] : []));
	return {
		key: schedule
			.map((step) => `${step.claimIndex}:${step.packs.map((p) => `${p.count}x${p.documents}`).join("+")}`)
			.join("|"),
		packs,
		bought: purchase.totalDocuments,
		spare: purchase.balanceDocuments,
		tarCoins: packs.reduce((sum, pack) => sum + pack.tarCoins * pack.count, 0),
		schedule,
	};
}
export type DocumentPlan = ReturnType<typeof documentPlan>;
