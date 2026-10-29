import { TRADER_ALIBI_TRADER_IDS } from "@/lib/games/trader-alibi";
import type { TraderAlibiPageData } from "@/types/contracts";
import type { ItemSummary } from "@/types/items";

export const MAX_QUESTIONS = 5;
export const CLUE_KINDS = ["objective", "barter", "sold"] as const;
export type ClueKind = (typeof CLUE_KINDS)[number];

export interface ClueItem {
	item: ItemSummary;
	count: number;
}

export type TraderClue =
	| {
			kind: "objective";
			text: string;
			count: number;
			/** A single-item hand-in, shown with its item. */
			handIn?: { item: ItemSummary; foundInRaid: boolean };
			maps: string[];
	  }
	| { kind: "barter"; level: number; output: ClueItem; inputs: ClueItem[] }
	| { kind: "sold"; level: number; item: ItemSummary };

export type TraderCluePools = Map<string, Record<ClueKind, TraderClue[]>>;

/**
 * Each playable trader's clues, with item references resolved against the catalog; clues naming an item the
 * catalog lacks are dropped. Clues may be shared between traders (several sell the same item), which is part
 * of the puzzle. Traders without any clue are left out.
 */
export function buildCluePools(data: TraderAlibiPageData, catalog: readonly ItemSummary[]): TraderCluePools {
	const items = new Map(catalog.map((item) => [item.id, item]));
	const pools: TraderCluePools = new Map(
		TRADER_ALIBI_TRADER_IDS.map((id) => [id, { objective: [], barter: [], sold: [] }]),
	);
	const seenSold = new Set<string>();
	for (const objective of data.objectives) {
		const item = objective.itemId ? items.get(objective.itemId) : undefined;
		pools.get(objective.traderId)?.objective.push({
			kind: "objective",
			text: objective.text,
			count: objective.count,
			...(item ? { handIn: { item, foundInRaid: objective.foundInRaid === true } } : {}),
			maps: objective.maps,
		});
	}
	for (const barter of data.barters) {
		const output = items.get(barter.output.itemId);
		const inputs = barter.inputs.map((input) => ({ item: items.get(input.itemId), count: input.count }));
		if (!output || inputs.some((input) => !input.item)) continue;
		pools.get(barter.traderId)?.barter.push({
			kind: "barter",
			level: barter.level,
			output: { item: output, count: barter.output.count },
			inputs: inputs as ClueItem[],
		});
	}
	for (const offer of data.offers) {
		const item = items.get(offer.itemId);
		const key = `${offer.traderId}:${offer.itemId}`;
		if (!item || seenSold.has(key)) continue;
		seenSold.add(key);
		pools.get(offer.traderId)?.sold.push({ kind: "sold", level: offer.level, item });
	}
	for (const [id, pool] of pools) if (CLUE_KINDS.every((kind) => !pool[kind].length)) pools.delete(id);
	return pools;
}

export function questionPoints(questions: number): number {
	return Math.max(1, MAX_QUESTIONS + 1 - questions);
}

function choose<T>(values: readonly T[], random: () => number): T {
	return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

/** A different trader from the last round when possible. */
export function pickTrader(pools: TraderCluePools, previous: string | null, random: () => number = Math.random) {
	const ids = [...pools.keys()];
	const options = ids.length > 1 ? ids.filter((id) => id !== previous) : ids;
	return options.length ? choose(options, random) : null;
}

/** Clue indices of one kind this round has not shown yet. */
export function unusedClues(
	pools: TraderCluePools,
	traderId: string,
	kind: ClueKind,
	used: ReadonlySet<string>,
): number[] {
	const clues = pools.get(traderId)?.[kind] ?? [];
	return clues.flatMap((_, index) => (used.has(`${kind}:${index}`) ? [] : [index]));
}

export function drawClue(
	pools: TraderCluePools,
	traderId: string,
	kind: ClueKind,
	used: ReadonlySet<string>,
	random: () => number = Math.random,
): { key: string; clue: TraderClue } | null {
	const options = unusedClues(pools, traderId, kind, used);
	if (!options.length) return null;
	const index = choose(options, random);
	return { key: `${kind}:${index}`, clue: pools.get(traderId)![kind][index] };
}
