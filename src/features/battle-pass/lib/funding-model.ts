import type { Tile } from "./battle-pass-model";
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
export function rewardTarCoins(tile: Tile) {
	return tile.rewards.reduce(
		(sum, reward) => sum + (reward.type === "tarcoin" ? Math.max(0, Math.floor(reward.value ?? 0)) : 0),
		0,
	);
}
/** Dominance DP: for each purchased document count retain the least spent TC.
 * Less spent TC dominates every future wallet constraint. */
export function optimizeRouteFunding(claims: FundingClaim[], startingTarCoins: number, allowSpecial: boolean) {
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
	// All currency pack sizes are multiples of 50. The first amount covering the
	// minimum initial capital that minimizes cash is globally optimal.
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
	let bestCash = Infinity,
		bestTC = 0,
		bestRegular = 0,
		special = false;
	for (let tc = 0; tc <= max; tc++)
		for (const offer of allowSpecial ? [false, true] : [false]) {
			const total = tc + (offer ? offerPack.tarCoins / unit : 0),
				cost = cash[tc] + (offer ? offerPack.cents : 0);
			if (total >= target && (cost < bestCash || (cost === bestCash && total < bestTC))) {
				bestCash = cost;
				bestTC = total;
				bestRegular = tc;
				special = offer;
			}
		}

	const documentCounts = claims.map(() => DOCUMENT_PACKS.map(() => 0));
	const currencyCounts = TARCOIN_PACKS.map(() => 0);
	const solved = schedule(bestTC * unit, true);
	for (let path = solved.path; path; path = path.previous) documentCounts[path.index][path.pack]++;
	while (bestRegular > 0) {
		const k = previous[bestRegular];
		if (k < 0) throw new Error("Missing currency pack choice");
		currencyCounts[TARCOIN_PACKS.indexOf(regular[k])]++;
		bestRegular -= regular[k].tarCoins / unit;
	}
	if (special) currencyCounts[TARCOIN_PACKS.indexOf(offerPack)]++;
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
	return { cashCents, steps, totalDocuments, totalTarCoins, specialUsed: special, balanceTarCoins, balanceDocuments };
}
export type FundingPlan = ReturnType<typeof optimizeRouteFunding>;
