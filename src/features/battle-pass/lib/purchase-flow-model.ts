import type { FundingClaim, FundingPlan } from "./funding-model";
import type { GatheringQuantity } from "./gathering-savings-model";

type TarCoinPack = FundingPlan["cashReceipt"][number];
type DocumentPack = FundingPlan["steps"][number]["documentPacks"][number];
type GatherProfile = { profileKey: string; profileLabel: string; documents: GatheringQuantity[] };
/** Balances held after a step: TarCoins and classified documents (owned and bought). */
type Balance = { tarCoins: number; classified: number };
/** One claim in a run: documents gathered for it, classified documents it spends (owned and bought) and reward TarCoins. */
export type FlowClaim = Balance & {
	claim: number;
	gathered: GatheringQuantity[];
	classifiedSpent: number;
	rewardTarCoins: number;
};

export type FlowStep = Balance &
	(
		| { kind: "gather"; profiles: GatherProfile[] }
		| { kind: "tarcoins"; packs: (TarCoinPack & { count: number })[]; cashCents: number; carryover: boolean }
		| { kind: "classified"; packs: (DocumentPack & { count: number })[] }
		| { kind: "claims"; from: number; to: number; rewardTarCoins: number; items: FlowClaim[] }
	);

function group<T extends { count: number }>(items: Omit<T, "count">[], key: (item: Omit<T, "count">) => string) {
	const grouped = new Map<string, T>();
	for (const item of items) {
		const existing = grouped.get(key(item));
		if (existing) existing.count++;
		else grouped.set(key(item), { ...item, count: 1 } as T);
	}
	return [...grouped.values()];
}

const sumTarCoins = (packs: { tarCoins: number }[]) => packs.reduce((sum, pack) => sum + pack.tarCoins, 0);

function byProfile(rows: GatheringQuantity[]): GatherProfile[] {
	const profiles = new Map<string, GatherProfile>();
	for (const row of rows) {
		const profile = profiles.get(row.profileKey) ?? {
			profileKey: row.profileKey,
			profileLabel: row.profileLabel,
			documents: [],
		};
		const existing = profile.documents.find((doc) => doc.documentKey === row.documentKey);
		if (existing) existing.quantity += row.quantity;
		else profile.documents.push({ ...row });
		profiles.set(row.profileKey, profile);
	}
	return [...profiles.values()];
}

/** Just-in-time order: gather each run of claims' ordinary documents, buy TarCoins only
 * when the next classified pack is unaffordable, and buy each classified pack
 * only when a claim needs it. Packs keep the funding plan's order and are bought
 * no earlier than planned, so earned TarCoins always cover them. TarCoins the
 * purchase adds beyond the claims are listed last. Claim numbers are 1-based.
 * Each step carries the balances held after it; `ownedClassified` is the
 * spendable classified balance before the first claim. */
export function purchaseFlow(
	plan: FundingPlan,
	claims: (FundingClaim & { classifiedUsed?: number })[],
	startingTarCoins: number,
	gatheredByClaim: GatheringQuantity[][] = [],
	ownedClassified = 0,
): FlowStep[] {
	const tarCoinPacks: Omit<TarCoinPack, "count">[] = plan.cashReceipt.flatMap(({ count, ...pack }) =>
		Array.from({ length: count }, () => pack),
	);
	const documentPacks: Omit<DocumentPack, "count">[] = plan.steps.flatMap((step) =>
		step.documentPacks.flatMap(({ count, ...pack }) => Array.from({ length: count }, () => pack)),
	);
	const tarCoinKey = (pack: Omit<TarCoinPack, "count">) => `${pack.tarCoins}:${pack.special}`;
	const buyTarCoins = (gap: number) => {
		// The smallest remaining pack that closes the gap, otherwise the largest.
		const sorted = [...tarCoinPacks].sort((a, b) => a.tarCoins - b.tarCoins);
		const pack = sorted.find((p) => p.tarCoins >= gap) ?? sorted.at(-1);
		if (!pack) throw new Error("The TarCoin purchase does not cover the classified packs.");
		tarCoinPacks.splice(tarCoinPacks.indexOf(pack), 1);
		return pack;
	};
	const flow: FlowStep[] = [];
	let wallet = Math.max(0, Math.floor(startingTarCoins));
	let documents = 0;
	let owned = Math.max(
		Math.floor(ownedClassified),
		claims.reduce((sum, claim) => sum + (claim.classifiedUsed ?? 0), 0),
	);
	const balance = (): Balance => ({ tarCoins: wallet, classified: owned + documents });
	let run: Extract<FlowStep, { kind: "claims" }> | null = null;
	let gather: Extract<FlowStep, { kind: "gather" }> | null = null;
	const gatherRows = new Map<Extract<FlowStep, { kind: "gather" }>, GatheringQuantity[]>();
	const purchase = (bought: Omit<TarCoinPack, "count">[], carryover: boolean): FlowStep => ({
		...balance(),
		kind: "tarcoins",
		packs: group<TarCoinPack>(bought, tarCoinKey),
		cashCents: bought.reduce((sum, pack) => sum + pack.cents, 0),
		carryover,
	});
	claims.forEach((claim, index) => {
		const gathered = gatheredByClaim[index] ?? [];
		const coins: Omit<TarCoinPack, "count">[] = [];
		const packs: Omit<DocumentPack, "count">[] = [];
		const before = balance();
		while (documents < claim.additionalClassified) {
			const pack = documentPacks.shift();
			if (!pack) throw new Error("The classified packs do not cover the claims.");
			while (wallet < pack.tarCoins) {
				const bought = buyTarCoins(pack.tarCoins - wallet);
				wallet += bought.tarCoins;
				coins.push(bought);
			}
			wallet -= pack.tarCoins;
			documents += pack.documents;
			packs.push(pack);
		}
		// Purchases split the claims into runs. Each run gathers all of its
		// ordinary documents up front, before the purchases that open it.
		if (packs.length || !run) {
			gather = { ...before, kind: "gather", profiles: [] };
			gatherRows.set(gather, []);
			flow.push(gather);
			// Bought TarCoins show as one row before the packs they pay for.
			if (coins.length)
				flow.push({
					...purchase(coins, false),
					tarCoins: before.tarCoins + sumTarCoins(coins),
					classified: before.classified,
				});
			if (packs.length)
				flow.push({
					...balance(),
					kind: "classified",
					packs: group<DocumentPack>(packs, (pack) => String(pack.documents)),
				});
			run = { ...balance(), kind: "claims", from: index + 1, to: index + 1, rewardTarCoins: 0, items: [] };
			flow.push(run);
		}
		gatherRows.get(gather!)!.push(...gathered);
		const used = claim.classifiedUsed ?? 0;
		owned -= used;
		documents -= claim.additionalClassified;
		wallet += claim.tarCoins;
		run.to = index + 1;
		run.rewardTarCoins += claim.tarCoins;
		run.items.push({
			...balance(),
			claim: index + 1,
			gathered,
			classifiedSpent: used + claim.additionalClassified,
			rewardTarCoins: claim.tarCoins,
		});
		Object.assign(run, balance());
	});
	if (tarCoinPacks.length) {
		wallet += sumTarCoins(tarCoinPacks);
		flow.push(purchase(tarCoinPacks, true));
	}
	for (const [step, rows] of gatherRows) step.profiles = byProfile(rows);
	return flow.filter((step) => step.kind !== "gather" || step.profiles.length > 0);
}
