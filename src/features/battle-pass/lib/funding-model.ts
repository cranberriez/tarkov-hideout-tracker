import type { Tile } from "./battle-pass-model";
export const CASH_TOLERANCE_CENTS = 10;
export const DOCUMENT_PACKS = [
	{ documents: 20, tarCoins: 500 },
	{ documents: 40, tarCoins: 950 },
	{ documents: 75, tarCoins: 1680 },
	{ documents: 250, tarCoins: 5000 },
	{ documents: 500, tarCoins: 8750 },
];
export const TARCOIN_PACKS = [
	{ tarCoins: 500, cents: 499, special: false },
	{ tarCoins: 1100, cents: 999, special: false },
	{ tarCoins: 2300, cents: 1999, special: false },
	{ tarCoins: 6000, cents: 4999, special: false },
	{ tarCoins: 12500, cents: 9999, special: false },
	{ tarCoins: 20250, cents: 14999, special: false },
	{ tarCoins: 2000, cents: 999, special: true },
];
export interface FundingClaim {
	rewardId: string;
	page: number;
	additionalClassified: number;
	tarCoins: number;
}
export function buildCashReceipt(counts: number[]) {
	return TARCOIN_PACKS.flatMap((pack, k) =>
		counts[k] ? [{ ...pack, count: counts[k], subtotalCents: pack.cents * counts[k] }] : [],
	);
}
export function rewardTarCoins(tile: Tile) {
	return tile.rewards.reduce(
		(sum, reward) => sum + (reward.type === "tarcoin" ? Math.max(0, Math.floor(reward.value ?? 0)) : 0),
		0,
	);
}
/** Fewest TarCoins buying at least `demand` classified documents when the
 * whole wallet is available up front. Reference only: real purchases must wait
 * for TarCoins earned along the claim order. */
export function cheapestDocumentPacks(demand: number) {
	const need = Math.max(0, Math.floor(demand));
	const cap = need + Math.max(...DOCUMENT_PACKS.map((p) => p.documents)) - 1;
	const cost = new Float64Array(cap + 1).fill(Infinity);
	const choice = new Int32Array(cap + 1).fill(-1);
	cost[0] = 0;
	for (let d = 0; d <= cap; d++)
		if (Number.isFinite(cost[d]))
			DOCUMENT_PACKS.forEach((pack, k) => {
				const next = d + pack.documents;
				if (next <= cap && cost[d] + pack.tarCoins < cost[next]) {
					cost[next] = cost[d] + pack.tarCoins;
					choice[next] = k;
				}
			});
	let best = need;
	for (let d = need; d <= cap; d++) if (cost[d] < cost[best]) best = d;
	const counts = DOCUMENT_PACKS.map(() => 0);
	for (let d = best; d > 0; d -= DOCUMENT_PACKS[choice[d]].documents) counts[choice[d]]++;
	return {
		packs: DOCUMENT_PACKS.flatMap((pack, k) => (counts[k] ? [{ ...pack, count: counts[k] }] : [])),
		documents: best,
		tarCoins: cost[best],
	};
}

/** Dominance DP: for each purchased document count retain the least spent TC.
 * Less spent TC dominates every future wallet constraint. */
function solveFunding(claims: FundingClaim[], startingTarCoins: number, allowSpecial: boolean) {
	const starting = Number.isFinite(startingTarCoins) ? Math.max(0, Math.floor(startingTarCoins)) : 0;
	const demand = claims.reduce((s, c) => s + c.additionalClassified, 0);
	const maxDocumentPack = Math.max(...DOCUMENT_PACKS.map((p) => p.documents));
	const cap = demand + maxDocumentPack - 1;
	type Path = { previous: Path | null; index: number; pack: number };
	function schedule(extra: number, record = false) {
		const dp = new Float64Array(cap + 1).fill(Infinity);
		dp[0] = 0;
		const paths: (Path | null)[] = record ? Array(cap + 1).fill(null) : [];
		let required = 0,
			earned = 0;
		for (let index = 0; index < claims.length; index++) {
			const claim = claims[index];
			if (claim.additionalClassified > 0) {
				const limit = starting + extra + earned;
				for (let d = required; d <= cap; d++) {
					if (!Number.isFinite(dp[d])) continue;
					DOCUMENT_PACKS.forEach((pack, k) => {
						const next = d + pack.documents,
							cost = dp[d] + pack.tarCoins;
						if (next <= cap && cost <= limit && cost < dp[next]) {
							dp[next] = cost;
							if (record) paths[next] = { previous: paths[d], index, pack: k };
						}
					});
				}
				required += claim.additionalClassified;
				dp.fill(Infinity, 0, required);
			}
			earned += claim.tarCoins;
		}
		let best = -1;
		for (let d = demand; d <= cap; d++) if (Number.isFinite(dp[d]) && (best < 0 || dp[d] < dp[best])) best = d;
		return { feasible: best >= 0, path: best >= 0 ? paths[best] : null };
	}
	let low = 0,
		high = Math.ceil(demand / DOCUMENT_PACKS[0].documents) * DOCUMENT_PACKS[0].tarCoins;
	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		if (schedule(mid).feasible) high = mid;
		else low = mid + 1;
	}
	const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
	const unit = TARCOIN_PACKS.reduce((n, p) => gcd(n, p.tarCoins), 0);
	const offerPack = TARCOIN_PACKS.find((p) => p.special)!;
	const target = Math.ceil(low / unit),
		max = target + Math.max(...TARCOIN_PACKS.map((p) => p.tarCoins)) / unit;
	const regular = TARCOIN_PACKS.filter((p) => !p.special);
	const cash = new Float64Array(max + 1).fill(Infinity);
	cash[0] = 0;
	const previous = new Int32Array(max + 1).fill(-1);
	for (let tc = 0; tc <= max; tc++)
		if (Number.isFinite(cash[tc]))
			regular.forEach((pack, k) => {
				const next = tc + pack.tarCoins / unit;
				if (next <= max && cash[tc] + pack.cents < cash[next]) {
					cash[next] = cash[tc] + pack.cents;
					previous[next] = k;
				}
			});
	// Every pack costs more than the tolerance. A plan with a removable pack
	// would therefore exceed the ceiling if the remaining packs cover the route.
	const candidates = [];
	for (let tc = 0; tc <= max; tc++) {
		if (!Number.isFinite(cash[tc])) continue;
		for (const special of allowSpecial ? [false, true] : [false]) {
			const total = tc + (special ? offerPack.tarCoins / unit : 0);
			if (total >= target)
				candidates.push({ total, regularUnits: tc, special, cents: cash[tc] + (special ? offerPack.cents : 0) });
		}
	}
	const minimum = candidates.reduce((best, option) =>
		option.cents < best.cents || (option.cents === best.cents && option.total > best.total) ? option : best,
	);
	const recommended = candidates.reduce((best, option) => {
		if (option.cents > minimum.cents + CASH_TOLERANCE_CENTS) return best;
		return option.total > best.total || (option.total === best.total && option.cents < best.cents) ? option : best;
	}, minimum);

	/** `packIndex` buys exactly that one regular pack instead of the cheapest combination. */
	function purchasePlan(choice: typeof minimum, packIndex?: number) {
		const { total: bestTC, special } = choice;
		let bestRegular = choice.regularUnits;
		const documentCounts = claims.map(() => DOCUMENT_PACKS.map(() => 0));
		const currencyCounts = TARCOIN_PACKS.map(() => 0);
		const solved = schedule(bestTC * unit, true);
		for (let path = solved.path; path; path = path.previous) documentCounts[path.index][path.pack]++;
		if (packIndex !== undefined) {
			currencyCounts[packIndex]++;
			bestRegular = 0;
		}
		while (bestRegular > 0) {
			const k = previous[bestRegular];
			if (k < 0) throw new Error("Missing currency pack choice");
			currencyCounts[TARCOIN_PACKS.indexOf(regular[k])]++;
			bestRegular -= regular[k].tarCoins / unit;
		}
		if (special) currencyCounts[TARCOIN_PACKS.indexOf(offerPack)]++;
		const cashReceipt = buildCashReceipt(currencyCounts);
		let balanceTarCoins = starting,
			balanceDocuments = 0,
			cashCents = 0,
			totalDocuments = 0,
			totalTarCoins = 0;
		const first = claims.findIndex((c) => c.additionalClassified > 0);
		const steps = claims.map((claim, index) => {
			const documentPacks = DOCUMENT_PACKS.flatMap((pack, k) =>
				documentCounts[index][k] ? [{ ...pack, count: documentCounts[index][k] }] : [],
			);
			const tarCoinPacks =
				index === first
					? TARCOIN_PACKS.flatMap((pack, k) => (currencyCounts[k] ? [{ ...pack, count: currencyCounts[k] }] : []))
					: [];
			for (const pack of tarCoinPacks) {
				balanceTarCoins += pack.tarCoins * pack.count;
				totalTarCoins += pack.tarCoins * pack.count;
				cashCents += pack.cents * pack.count;
			}
			for (const pack of documentPacks) {
				balanceTarCoins -= pack.tarCoins * pack.count;
				balanceDocuments += pack.documents * pack.count;
				totalDocuments += pack.documents * pack.count;
			}
			balanceDocuments -= claim.additionalClassified;
			if (balanceTarCoins < 0 || balanceDocuments < 0)
				throw new Error("Funding schedule spends unearned currency or unowned documents.");
			balanceTarCoins += claim.tarCoins;
			return {
				rewardId: claim.rewardId,
				documentPacks,
				tarCoinPacks,
				rewardTarCoins: claim.tarCoins,
				balanceTarCoins,
				balanceDocuments,
			};
		});
		return {
			cashCents,
			cashReceipt,
			steps,
			totalDocuments,
			totalTarCoins,
			specialUsed: special,
			balanceTarCoins,
			balanceDocuments,
		};
	}
	return { candidates, minimum, recommended, purchasePlan, target, unit, offerPack };
}

/** The cheapest single regular TarCoin pack, with the one-time offer when it is
 * allowed, that funds the claims and costs more than `aboveCents`. */
export function singlePackOption(
	claims: FundingClaim[],
	startingTarCoins: number,
	allowSpecial: boolean,
	aboveCents: number,
) {
	const { purchasePlan, target, unit, offerPack } = solveFunding(claims, startingTarCoins, allowSpecial);
	const extra = allowSpecial ? offerPack : null;
	const pack = TARCOIN_PACKS.filter((p) => !p.special)
		.sort((a, b) => a.cents - b.cents)
		.find((p) => (p.tarCoins + (extra?.tarCoins ?? 0)) / unit >= target && p.cents + (extra?.cents ?? 0) > aboveCents);
	if (!pack) return null;
	const choice = {
		total: (pack.tarCoins + (extra?.tarCoins ?? 0)) / unit,
		regularUnits: pack.tarCoins / unit,
		special: !!extra,
		cents: pack.cents + (extra?.cents ?? 0),
	};
	return { ...purchasePlan(choice, TARCOIN_PACKS.indexOf(pack)), recommended: false };
}

export function optimizeRouteFunding(claims: FundingClaim[], startingTarCoins: number, allowSpecial: boolean) {
	const { minimum, recommended, purchasePlan } = solveFunding(claims, startingTarCoins, allowSpecial);
	const plan = purchasePlan(recommended);
	const cheapest = recommended.cents === minimum.cents ? null : purchasePlan(minimum);
	return {
		...plan,
		minimumCashCents: minimum.cents,
		minimumPurchase: cheapest && {
			cashCents: cheapest.cashCents,
			cashReceipt: cheapest.cashReceipt,
			totalTarCoins: cheapest.totalTarCoins,
			balanceTarCoins: cheapest.balanceTarCoins,
		},
	};
}
/** Every TarCoin purchase within `windowCents` of the minimum where paying more
 * leaves more TarCoins after the pass, cheapest first. Each option is replayed
 * against the claim order, because a larger wallet can afford larger, cheaper
 * classified packs earlier. */
export function fundingOptions(
	claims: FundingClaim[],
	startingTarCoins: number,
	allowSpecial: boolean,
	windowCents: number,
) {
	const { candidates, minimum, recommended, purchasePlan } = solveFunding(claims, startingTarCoins, allowSpecial);
	const cheapestFirst = candidates
		.filter((option) => option.cents <= minimum.cents + windowCents)
		.sort((a, b) => a.cents - b.cents || b.total - a.total);
	const options: (ReturnType<typeof purchasePlan> & { recommended: boolean })[] = [];
	let seenCents = -1;
	for (const option of cheapestFirst) {
		if (option.cents === seenCents) continue;
		seenCents = option.cents;
		const plan = purchasePlan(option);
		if (options.length && plan.balanceTarCoins <= options.at(-1)!.balanceTarCoins) continue;
		options.push({
			...plan,
			recommended: option.cents === recommended.cents && option.total === recommended.total,
		});
	}
	return options;
}
export type FundingOption = ReturnType<typeof fundingOptions>[number];

/** Compare single bundles using the same classified-pack purchases and claims. */
export function compareCurrencyBundles(plan: FundingPlan, allowSpecial: boolean) {
	const { cashCents, totalTarCoins, balanceTarCoins, cashReceipt } = plan;
	const larger = TARCOIN_PACKS.filter(
		(pack) =>
			cashCents > 0 && (!pack.special || allowSpecial) && pack.tarCoins > totalTarCoins && pack.cents > cashCents,
	);
	const nextPrice = Math.min(...larger.map((pack) => pack.cents));
	return {
		cashCents,
		totalTarCoins,
		balanceTarCoins,
		cashReceipt,
		minimumPurchase: plan.minimumPurchase,
		alternatives: larger
			.filter((pack) => pack.cents === nextPrice)
			.map((pack) => ({
				...pack,
				balanceTarCoins: balanceTarCoins + pack.tarCoins - totalTarCoins,
			})),
	};
}
export type CurrencyComparison = ReturnType<typeof compareCurrencyBundles>;
export type FundingPlan = ReturnType<typeof optimizeRouteFunding>;

/** Largest extra TarCoin balance worth suggesting: farming is slow and unreliable. */
export const TARCOIN_FARMING_CAP = 250;

/** Smallest extra starting balances (up to `cap`) that lower the cash paid: the
 * first drop, then the lowest cash within `cap` when that is cheaper still.
 * Cash never rises with a larger balance, so each drop is found by bisection. */
export function tarCoinFarmingSavings(
	claims: FundingClaim[],
	startingTarCoins: number,
	allowSpecial: boolean,
	cap = TARCOIN_FARMING_CAP,
) {
	const cache = new Map<number, number>();
	const cash = (extra: number) => {
		if (!cache.has(extra))
			cache.set(extra, optimizeRouteFunding(claims, startingTarCoins + extra, allowSpecial).cashCents);
		return cache.get(extra)!;
	};
	const baseline = cash(0);
	const savings: { extraTarCoins: number; cashCents: number; savingsCents: number }[] = [];
	const firstBelow = (target: number, from: number) => {
		let low = from,
			high = cap;
		while (low < high) {
			const middle = Math.floor((low + high) / 2);
			if (cash(middle) < target) high = middle;
			else low = middle + 1;
		}
		return low;
	};
	if (baseline - cash(cap) <= CASH_TOLERANCE_CENTS) return savings;
	const first = firstBelow(baseline - CASH_TOLERANCE_CENTS, 1);
	savings.push({ extraTarCoins: first, cashCents: cash(first), savingsCents: baseline - cash(first) });
	if (cash(first) - cash(cap) > CASH_TOLERANCE_CENTS) {
		const best = firstBelow(cash(cap) + CASH_TOLERANCE_CENTS + 1, first + 1);
		savings.push({ extraTarCoins: best, cashCents: cash(best), savingsCents: baseline - cash(best) });
	}
	return savings;
}
